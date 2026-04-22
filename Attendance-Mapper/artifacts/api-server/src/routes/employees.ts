import { Router, type IRouter } from "express";
import {
  db,
  employeesTable,
  departmentsTable,
  attendanceTable,
  overtimeTable,
  leavesTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql, asc } from "drizzle-orm";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

const baseSelect = {
  id: employeesTable.id,
  employeeCode: employeesTable.employeeCode,
  name: employeesTable.name,
  departmentId: employeesTable.departmentId,
  designation: employeesTable.designation,
  monthlyWage: employeesTable.monthlyWage,
  statsEligible: employeesTable.statsEligible,
  otEligible: employeesTable.otEligible,
  createdAt: employeesTable.createdAt,
  departmentName: departmentsTable.name,
};

function shape(row: any) {
  return {
    ...row,
    monthlyWage: Number(row.monthlyWage),
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/employees", async (req, res) => {
  const q = ListEmployeesQueryParams.parse(req.query);
  const where = q.departmentId !== undefined ? eq(employeesTable.departmentId, q.departmentId) : undefined;
  const rows = await db
    .select(baseSelect)
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(where)
    .orderBy(asc(departmentsTable.displayOrder), asc(employeesTable.employeeCode));
  res.json(rows.map(shape));
});

router.post("/employees", async (req, res) => {
  const body = CreateEmployeeBody.parse(req.body);
  const [row] = await db
    .insert(employeesTable)
    .values({
      employeeCode: body.employeeCode,
      name: body.name,
      departmentId: body.departmentId,
      designation: body.designation,
      monthlyWage: String(body.monthlyWage ?? 0),
      statsEligible: body.statsEligible ?? true,
      otEligible: body.otEligible ?? true,
    })
    .returning();
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, row.departmentId));
  res.status(201).json(shape({ ...row, departmentName: dept?.name ?? "" }));
});

router.get("/employees/:employeeId", async (req, res) => {
  const { employeeId } = GetEmployeeParams.parse({ employeeId: Number(req.params["employeeId"]) });
  const [row] = await db
    .select(baseSelect)
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, employeeId));
  if (!row) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  const { start, end } = monthBounds();
  const monthAttendance = await db
    .select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, employeeId),
        gte(attendanceTable.date, start),
        lte(attendanceTable.date, end),
      ),
    )
    .groupBy(attendanceTable.status);
  let present = 0,
    absent = 0,
    total = 0;
  for (const r of monthAttendance) {
    total += r.count;
    if (r.status === "present") present += r.count;
    else if (r.status === "absent") absent += r.count;
  }
  const ot = await db
    .select({ total: sql<number>`coalesce(sum(${overtimeTable.hours}), 0)::float` })
    .from(overtimeTable)
    .where(
      and(
        eq(overtimeTable.employeeId, employeeId),
        gte(overtimeTable.date, start),
        lte(overtimeTable.date, end),
      ),
    );

  const balance = await computeLeaveBalance(employeeId);

  res.json({
    employee: shape(row),
    monthAttendanceRate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    daysPresentThisMonth: present,
    daysAbsentThisMonth: absent,
    overtimeHoursThisMonth: ot[0]?.total ?? 0,
    leaveBalance: balance,
  });
});

router.patch("/employees/:employeeId", async (req, res) => {
  const { employeeId } = UpdateEmployeeParams.parse({ employeeId: Number(req.params["employeeId"]) });
  const body = UpdateEmployeeBody.parse(req.body);
  const updates: Record<string, unknown> = {};
  if (body.employeeCode !== undefined) updates["employeeCode"] = body.employeeCode;
  if (body.name !== undefined) updates["name"] = body.name;
  if (body.departmentId !== undefined) updates["departmentId"] = body.departmentId;
  if (body.designation !== undefined) updates["designation"] = body.designation;
  if (body.monthlyWage !== undefined) updates["monthlyWage"] = String(body.monthlyWage);
  if (body.statsEligible !== undefined) updates["statsEligible"] = body.statsEligible;
  if (body.otEligible !== undefined) updates["otEligible"] = body.otEligible;
  const [row] = await db
    .update(employeesTable)
    .set(updates)
    .where(eq(employeesTable.id, employeeId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, row.departmentId));
  res.json(shape({ ...row, departmentName: dept?.name ?? "" }));
});

router.delete("/employees/:employeeId", async (req, res) => {
  const { employeeId } = DeleteEmployeeParams.parse({ employeeId: Number(req.params["employeeId"]) });
  await db.delete(employeesTable).where(eq(employeesTable.id, employeeId));
  res.status(204).send();
});

const ALLOTMENT = { CL: 12, SL: 7, EL: 15 } as const;

export async function computeLeaveBalance(employeeId: number) {
  const rows = await db
    .select({ leaveType: leavesTable.leaveType, days: sql<number>`coalesce(sum((${leavesTable.endDate} - ${leavesTable.startDate}) + 1), 0)::int` })
    .from(leavesTable)
    .where(and(eq(leavesTable.employeeId, employeeId), eq(leavesTable.status, "approved")))
    .groupBy(leavesTable.leaveType);
  const used: Record<string, number> = { CL: 0, SL: 0, EL: 0, LOP: 0 };
  for (const r of rows) used[r.leaveType] = r.days;
  return {
    employeeId,
    CL: { allotted: ALLOTMENT.CL, used: used["CL"], remaining: ALLOTMENT.CL - used["CL"] },
    SL: { allotted: ALLOTMENT.SL, used: used["SL"], remaining: ALLOTMENT.SL - used["SL"] },
    EL: { allotted: ALLOTMENT.EL, used: used["EL"], remaining: ALLOTMENT.EL - used["EL"] },
    LOP: { used: used["LOP"] },
  };
}

export default router;
