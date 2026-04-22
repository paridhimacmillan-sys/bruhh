import { Router, type IRouter } from "express";
import {
  db,
  attendanceTable,
  employeesTable,
  departmentsTable,
  leavesTable,
  overtimeTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  GetDailyReportQueryParams,
  GetMonthlyReportQueryParams,
  GetAbsenteeismReportQueryParams,
  GetForm12ReportQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: fmt(start), end: fmt(end), startDate: start, endDate: end };
}

function isoDates(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(fmt(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function workingDays(start: Date, end: Date): number {
  let n = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getUTCDay();
    if (d !== 0) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

router.get("/reports/daily", async (req, res) => {
  const q = GetDailyReportQueryParams.parse(req.query);
  const dateStr = fmt(q.date);

  const employees = await db
    .select({
      id: employeesTable.id,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId));

  const records = await db.select().from(attendanceTable).where(eq(attendanceTable.date, dateStr));
  const recMap = new Map(records.map((r) => [r.employeeId, r.status]));

  const approvedLeaves = await db
    .select()
    .from(leavesTable)
    .where(
      and(
        eq(leavesTable.status, "approved"),
        lte(leavesTable.startDate, dateStr),
        gte(leavesTable.endDate, dateStr),
      ),
    );
  const onLeaveSet = new Set(approvedLeaves.map((l) => l.employeeId));

  const statusFor = (id: number) => recMap.get(id) ?? (onLeaveSet.has(id) ? "on_leave" : "absent");

  let present = 0,
    absent = 0,
    late = 0,
    halfDay = 0,
    onLeave = 0;
  const byDept = new Map<number, { departmentName: string; total: number; present: number; absent: number }>();

  for (const e of employees) {
    const s = statusFor(e.id);
    if (s === "present") present++;
    else if (s === "absent") absent++;
    else if (s === "late") late++;
    else if (s === "half_day") halfDay++;
    else if (s === "on_leave") onLeave++;
    const d = byDept.get(e.departmentId) ?? { departmentName: e.departmentName, total: 0, present: 0, absent: 0 };
    d.total++;
    if (s === "present" || s === "late" || s === "half_day") d.present++;
    else d.absent++;
    byDept.set(e.departmentId, d);
  }

  const total = employees.length;
  res.json({
    date: dateStr,
    totalEmployees: total,
    present,
    absent,
    late,
    halfDay,
    onLeave,
    attendanceRate: total > 0 ? Math.round(((present + late + halfDay) / total) * 1000) / 10 : 0,
    byDepartment: Array.from(byDept.entries()).map(([departmentId, v]) => ({
      departmentId,
      departmentName: v.departmentName,
      total: v.total,
      present: v.present,
      absent: v.absent,
      attendanceRate: v.total > 0 ? Math.round((v.present / v.total) * 1000) / 10 : 0,
    })),
  });
});

router.get("/reports/monthly", async (req, res) => {
  const q = GetMonthlyReportQueryParams.parse(req.query);
  const { start, end, startDate, endDate } = monthBounds(q.month);
  const dates = isoDates(startDate, endDate);

  const employees = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      name: employeesTable.name,
      designation: employeesTable.designation,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(q.departmentId !== undefined ? eq(employeesTable.departmentId, q.departmentId) : undefined)
    .orderBy(departmentsTable.name, employeesTable.name);

  const records = await db
    .select()
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)));
  const recMap = new Map<string, string>();
  for (const r of records) recMap.set(`${r.employeeId}:${r.date}`, r.status);

  const leaves = await db
    .select()
    .from(leavesTable)
    .where(eq(leavesTable.status, "approved"));

  const wd = workingDays(startDate, endDate);

  const result = employees.map((e) => {
    const dailyStatuses = dates.map((date) => {
      const rec = recMap.get(`${e.id}:${date}`);
      if (rec) return { date, status: rec };
      const onLeave = leaves.some(
        (l) => l.employeeId === e.id && l.startDate <= date && l.endDate >= date,
      );
      return { date, status: onLeave ? "on_leave" : "absent" };
    });
    let present = 0, absent = 0, late = 0, halfDay = 0, onLeave = 0;
    for (const d of dailyStatuses) {
      if (d.status === "present") present++;
      else if (d.status === "absent") absent++;
      else if (d.status === "late") late++;
      else if (d.status === "half_day") halfDay++;
      else if (d.status === "on_leave") onLeave++;
    }
    const denom = wd;
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      departmentName: e.departmentName,
      designation: e.designation,
      present,
      absent,
      late,
      halfDay,
      onLeave,
      attendanceRate: denom > 0 ? Math.round(((present + late + halfDay) / denom) * 1000) / 10 : 0,
      dailyStatuses,
    };
  });

  res.json({ month: q.month, workingDays: wd, employees: result });
});

router.get("/reports/absenteeism", async (req, res) => {
  const q = GetAbsenteeismReportQueryParams.parse(req.query);
  const { start, end, startDate, endDate } = monthBounds(q.month);
  const wd = workingDays(startDate, endDate);

  const employees = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      name: employeesTable.name,
      designation: employeesTable.designation,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId));

  const counts = await db
    .select({
      employeeId: attendanceTable.employeeId,
      status: attendanceTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)))
    .groupBy(attendanceTable.employeeId, attendanceTable.status);

  const map = new Map<number, { absent: number; late: number; present: number; total: number }>();
  for (const c of counts) {
    const cur = map.get(c.employeeId) ?? { absent: 0, late: 0, present: 0, total: 0 };
    if (c.status === "absent") cur.absent += c.count;
    else if (c.status === "late") cur.late += c.count;
    else if (c.status === "present") cur.present += c.count;
    cur.total += c.count;
    map.set(c.employeeId, cur);
  }

  const employeesOut = employees
    .map((e) => {
      const m = map.get(e.id) ?? { absent: 0, late: 0, present: 0, total: 0 };
      const recordedAbsent = m.absent;
      const unrecorded = Math.max(0, wd - m.total);
      const totalAbsent = recordedAbsent + unrecorded;
      return {
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        departmentName: e.departmentName,
        designation: e.designation,
        absentDays: totalAbsent,
        lateDays: m.late,
        absenteeismRate: wd > 0 ? Math.round((totalAbsent / wd) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.absenteeismRate - a.absenteeismRate);

  res.json({ month: q.month, workingDays: wd, employees: employeesOut });
});

router.get("/reports/form12", async (req, res) => {
  const q = GetForm12ReportQueryParams.parse(req.query);
  const { start, end, startDate, endDate } = monthBounds(q.month);

  // Count Sundays in month
  let sundays = 0;
  let totalDays = 0;
  const cur = new Date(startDate);
  while (cur <= endDate) {
    if (cur.getUTCDay() === 0) sundays++;
    totalDays++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  const wd = workingDays(startDate, endDate);

  const employees = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      name: employeesTable.name,
      displayOrder: departmentsTable.displayOrder,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .orderBy(departmentsTable.displayOrder, employeesTable.employeeCode);

  const records = await db
    .select()
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)));

  // Compute per-employee credits for the month
  const credit = new Map<number, { worked: number; sunWorked: number }>();
  for (const r of records) {
    const cr = credit.get(r.employeeId) ?? { worked: 0, sunWorked: 0 };
    let dayValue = 0;
    if (r.status === "present" || r.status === "late") dayValue = 1;
    else if (r.status === "half_day") dayValue = 0.5;
    else if (r.status === "on_leave") dayValue = 1;
    if (dayValue > 0) {
      cr.worked += dayValue;
      const dayOfWeek = new Date(r.date + "T00:00:00Z").getUTCDay();
      if (dayOfWeek === 0) cr.sunWorked += dayValue;
    }
    credit.set(r.employeeId, cr);
  }

  const rows = employees.map((e, idx) => {
    const cr = credit.get(e.id) ?? { worked: 0, sunWorked: 0 };
    const sunWorked = Math.round(cr.sunWorked * 10) / 10;
    const totalDaysWorked = Math.round(cr.worked * 10) / 10;
    return {
      serial: idx + 1,
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      daysWorked: totalDaysWorked,
      sundaysWorked: sunWorked,
      holidaysWorked: 0,
      totalDays: totalDaysWorked,
      deductionHours: null,
    };
  });

  res.json({
    month: q.month,
    factoryName: "PREMIER PIN INDUSTRIES",
    workingDays: wd,
    sundays,
    holidays: 0,
    totalDays,
    employees: rows,
  });
});

router.get("/dashboard/summary", async (_req, res) => {
  const today = fmt(new Date());
  const now = new Date();
  const monthStart = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const monthEnd = fmt(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));

  const [{ count: totalEmployees }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable);
  const [{ count: totalDepartments }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departmentsTable);

  const todayRecords = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
  const approvedLeaves = await db
    .select()
    .from(leavesTable)
    .where(
      and(
        eq(leavesTable.status, "approved"),
        lte(leavesTable.startDate, today),
        gte(leavesTable.endDate, today),
      ),
    );
  const onLeaveSet = new Set(approvedLeaves.map((l) => l.employeeId));
  let todayPresent = 0,
    todayAbsent = 0;
  for (const r of todayRecords) {
    if (r.status === "present" || r.status === "late" || r.status === "half_day") todayPresent++;
    else if (r.status === "absent") todayAbsent++;
  }
  const recordedIds = new Set(todayRecords.map((r) => r.employeeId));
  const unrecordedAbsent = totalEmployees - recordedIds.size - onLeaveSet.size;
  todayAbsent += Math.max(0, unrecordedAbsent);

  const monthCounts = await db
    .select({ status: attendanceTable.status, count: sql<number>`count(*)::int` })
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, monthStart), lte(attendanceTable.date, monthEnd)))
    .groupBy(attendanceTable.status);
  let mPresent = 0,
    mTotal = 0;
  for (const r of monthCounts) {
    mTotal += r.count;
    if (r.status === "present" || r.status === "late" || r.status === "half_day") mPresent += r.count;
  }

  const [{ count: pendingLeaveRequests }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leavesTable)
    .where(eq(leavesTable.status, "pending"));

  const [otAgg] = await db
    .select({ total: sql<number>`coalesce(sum(${overtimeTable.hours}), 0)::float` })
    .from(overtimeTable)
    .where(and(gte(overtimeTable.date, monthStart), lte(overtimeTable.date, monthEnd)));

  res.json({
    totalEmployees,
    totalDepartments,
    todayPresent,
    todayAbsent,
    todayOnLeave: onLeaveSet.size,
    todayAttendanceRate:
      totalEmployees > 0 ? Math.round((todayPresent / totalEmployees) * 1000) / 10 : 0,
    monthAttendanceRate: mTotal > 0 ? Math.round((mPresent / mTotal) * 1000) / 10 : 0,
    pendingLeaveRequests,
    overtimeHoursThisMonth: otAgg?.total ?? 0,
    recentActivity: [],
  });
});

export default router;
