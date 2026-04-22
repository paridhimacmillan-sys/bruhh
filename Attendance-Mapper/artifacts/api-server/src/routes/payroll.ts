import { Router, type IRouter } from "express";
import {
  db,
  employeesTable,
  departmentsTable,
  attendanceTable,
  leavesTable,
  overtimeTable,
  payrollLinesTable,
} from "@workspace/db";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import {
  GetPayrollQueryParams,
  UpdatePayrollLineBody,
  UpdatePayrollLineParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PF_RATE = 0.12; // 12% employee PF (statutory)
const ESI_RATE = 0.0075; // 0.75% employee ESI

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: fmt(start), end: fmt(end), startDate: start, endDate: end };
}

function workingDays(start: Date, end: Date): number {
  let n = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getUTCDay() !== 0) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

router.get("/payroll", async (req, res) => {
  const q = GetPayrollQueryParams.parse(req.query);
  const { start, end, startDate, endDate } = monthBounds(q.month);
  const wd = workingDays(startDate, endDate);

  const employees = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      name: employeesTable.name,
      designation: employeesTable.designation,
      monthlyWage: employeesTable.monthlyWage,
      statsEligible: employeesTable.statsEligible,
      otEligible: employeesTable.otEligible,
      departmentName: departmentsTable.name,
      displayOrder: departmentsTable.displayOrder,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .orderBy(asc(departmentsTable.displayOrder), asc(employeesTable.employeeCode));

  const attRows = await db
    .select()
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)));
  const attByEmp = new Map<number, { present: number; halfDay: number; late: number; onLeave: number }>();
  for (const r of attRows) {
    const cur = attByEmp.get(r.employeeId) ?? { present: 0, halfDay: 0, late: 0, onLeave: 0 };
    if (r.status === "present") cur.present++;
    else if (r.status === "late") cur.late++;
    else if (r.status === "half_day") cur.halfDay++;
    else if (r.status === "on_leave") cur.onLeave++;
    attByEmp.set(r.employeeId, cur);
  }

  // Approved leaves intersecting the month → leave days
  const leaves = await db.select().from(leavesTable).where(eq(leavesTable.status, "approved"));
  const leaveDaysByEmp = new Map<number, number>();
  for (const l of leaves) {
    const ls = l.startDate > start ? l.startDate : start;
    const le = l.endDate < end ? l.endDate : end;
    if (ls > le) continue;
    const a = new Date(ls + "T00:00:00Z").getTime();
    const b = new Date(le + "T00:00:00Z").getTime();
    const days = Math.floor((b - a) / 86400000) + 1;
    leaveDaysByEmp.set(l.employeeId, (leaveDaysByEmp.get(l.employeeId) ?? 0) + days);
  }

  // Overtime hours per employee
  const otRows = await db
    .select()
    .from(overtimeTable)
    .where(and(gte(overtimeTable.date, start), lte(overtimeTable.date, end)));
  const otByEmp = new Map<number, number>();
  for (const o of otRows) {
    otByEmp.set(o.employeeId, (otByEmp.get(o.employeeId) ?? 0) + Number(o.hours));
  }

  // Payroll lines for the month
  const lines = await db
    .select()
    .from(payrollLinesTable)
    .where(eq(payrollLinesTable.month, q.month));
  const lineByEmp = new Map(lines.map((l) => [l.employeeId, l]));

  const totals = { basicPayable: 0, otAmount: 0, totalPayable: 0, deductions: 0, finalPayable: 0 };

  const rows = employees.map((e, idx) => {
    const att = attByEmp.get(e.id) ?? { present: 0, halfDay: 0, late: 0, onLeave: 0 };
    const leaveDays = leaveDaysByEmp.get(e.id) ?? 0;
    const otHours = e.otEligible ? otByEmp.get(e.id) ?? 0 : 0;

    const wage = Number(e.monthlyWage);
    const dailyRate = wd > 0 ? wage / wd : 0;
    const hourlyRate = dailyRate / 8;

    // Days credited toward basic = present + late + half_day*0.5 + on_leave (in-system) + approved leaves
    const daysPresent = round2(att.present + att.late + att.halfDay * 0.5 + att.onLeave + leaveDays);
    const basicPayable = round2(dailyRate * daysPresent);
    const otAmount = round2(hourlyRate * otHours * 2); // Double rate
    const totalPayable = round2(basicPayable + otAmount);

    const line = lineByEmp.get(e.id);
    const openingAdvance = line ? Number(line.openingAdvance) : 0;
    const advanceBank = line ? Number(line.advanceBank) : 0;
    const advanceCash = line ? Number(line.advanceCash) : 0;
    const hraElec = line ? Number(line.hraElec) : 0;
    const closingAdvance = line ? Number(line.closingAdvance) : 0;
    const balanceCheque = line ? Number(line.balanceCheque) : 0;

    const pfAmount = e.statsEligible ? round2(basicPayable * PF_RATE) : 0;
    const esiAmount = e.statsEligible ? round2(totalPayable * ESI_RATE) : 0;
    const deductions = round2(advanceBank + advanceCash + hraElec + pfAmount + esiAmount);
    const finalPayable = round2(totalPayable - deductions);

    totals.basicPayable = round2(totals.basicPayable + basicPayable);
    totals.otAmount = round2(totals.otAmount + otAmount);
    totals.totalPayable = round2(totals.totalPayable + totalPayable);
    totals.deductions = round2(totals.deductions + deductions);
    totals.finalPayable = round2(totals.finalPayable + finalPayable);

    return {
      serial: idx + 1,
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      departmentName: e.departmentName,
      monthlyWage: wage,
      statsEligible: e.statsEligible,
      otEligible: e.otEligible,
      daysPresent,
      leaves: round2(leaveDays + att.onLeave),
      otHours: round2(otHours),
      basicPayable,
      otAmount,
      totalPayable,
      openingAdvance,
      advanceBank,
      advanceCash,
      hraElec,
      pfAmount,
      esiAmount,
      deductions,
      closingAdvance,
      balanceCheque: balanceCheque || finalPayable,
      finalPayable,
    };
  });

  res.json({ month: q.month, workingDays: wd, totals, employees: rows });
});

router.put("/payroll/:employeeId", async (req, res) => {
  const { employeeId } = UpdatePayrollLineParams.parse({ employeeId: Number(req.params["employeeId"]) });
  const body = UpdatePayrollLineBody.parse(req.body);
  const values = {
    employeeId,
    month: body.month,
    openingAdvance: String(body.openingAdvance ?? 0),
    advanceBank: String(body.advanceBank ?? 0),
    advanceCash: String(body.advanceCash ?? 0),
    hraElec: String(body.hraElec ?? 0),
    closingAdvance: String(body.closingAdvance ?? 0),
    balanceCheque: String(body.balanceCheque ?? 0),
    notes: body.notes ?? null,
  };
  const [row] = await db
    .insert(payrollLinesTable)
    .values(values)
    .onConflictDoUpdate({
      target: [payrollLinesTable.employeeId, payrollLinesTable.month],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  const final = row;

  res.json({
    employeeId: final.employeeId,
    month: final.month,
    openingAdvance: Number(final.openingAdvance),
    advanceBank: Number(final.advanceBank),
    advanceCash: Number(final.advanceCash),
    hraElec: Number(final.hraElec),
    closingAdvance: Number(final.closingAdvance),
    balanceCheque: Number(final.balanceCheque),
    notes: final.notes,
  });
});

export default router;
