import { Router, type IRouter } from "express";
import { db, attendanceTable, employeesTable, departmentsTable, leavesTable } from "@workspace/db";
import { and, eq, lte, gte, asc } from "drizzle-orm";
import {
  GetDayAttendanceQueryParams,
  SetDayAttendanceBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Parse "HH:MM" → minutes since midnight (or null)
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function computeHours(
  in1: string | null,
  out1: string | null,
  in2: string | null,
  out2: string | null,
): number | null {
  let total = 0;
  let any = false;
  const a = toMinutes(in1), b = toMinutes(out1);
  if (a !== null && b !== null && b > a) { total += b - a; any = true; }
  const c = toMinutes(in2), d = toMinutes(out2);
  if (c !== null && d !== null && d > c) { total += d - c; any = true; }
  if (!any) return null;
  return Math.round((total / 60) * 100) / 100;
}

async function buildDayPayload(dateStr: string, departmentId?: number) {
  const employees = await db
    .select({
      id: employeesTable.id,
      employeeCode: employeesTable.employeeCode,
      name: employeesTable.name,
      designation: employeesTable.designation,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
      displayOrder: departmentsTable.displayOrder,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(departmentId !== undefined ? eq(employeesTable.departmentId, departmentId) : undefined)
    .orderBy(asc(departmentsTable.displayOrder), asc(employeesTable.employeeCode));

  const records = await db.select().from(attendanceTable).where(eq(attendanceTable.date, dateStr));
  const recordMap = new Map(records.map((r) => [r.employeeId, r]));

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

  const entries = employees.map((e) => {
    const rec = recordMap.get(e.id);
    const status = rec?.status ?? (onLeaveSet.has(e.id) ? "on_leave" : "absent");
    return {
      employeeId: e.id,
      employeeCode: e.employeeCode,
      employeeName: e.name,
      departmentName: e.departmentName,
      designation: e.designation,
      status,
      inTime1: rec?.inTime1 ?? null,
      outTime1: rec?.outTime1 ?? null,
      inTime2: rec?.inTime2 ?? null,
      outTime2: rec?.outTime2 ?? null,
      hoursWorked: rec?.hoursWorked != null ? Number(rec.hoursWorked) : null,
      note: rec?.note ?? null,
    };
  });

  const summary = {
    present: entries.filter((e) => e.status === "present").length,
    absent: entries.filter((e) => e.status === "absent").length,
    late: entries.filter((e) => e.status === "late").length,
    halfDay: entries.filter((e) => e.status === "half_day").length,
    onLeave: entries.filter((e) => e.status === "on_leave").length,
    total: entries.length,
  };
  return { date: dateStr, entries, summary };
}

router.get("/attendance/day", async (req, res) => {
  const q = GetDayAttendanceQueryParams.parse(req.query);
  const dateStr = fmt(q.date);
  res.json(await buildDayPayload(dateStr, q.departmentId));
});

router.put("/attendance/day", async (req, res) => {
  const body = SetDayAttendanceBody.parse(req.body);
  const dateStr = fmt(body.date);

  for (const entry of body.entries) {
    const in1 = entry.inTime1?.trim() || null;
    const out1 = entry.outTime1?.trim() || null;
    const in2 = entry.inTime2?.trim() || null;
    const out2 = entry.outTime2?.trim() || null;
    const hours = computeHours(in1, out1, in2, out2);
    const hoursStr = hours != null ? String(hours) : null;
    await db
      .insert(attendanceTable)
      .values({
        employeeId: entry.employeeId,
        date: dateStr,
        status: entry.status,
        inTime1: in1,
        outTime1: out1,
        inTime2: in2,
        outTime2: out2,
        hoursWorked: hoursStr,
        note: entry.note ?? null,
      })
      .onConflictDoUpdate({
        target: [attendanceTable.employeeId, attendanceTable.date],
        set: {
          status: entry.status,
          inTime1: in1,
          outTime1: out1,
          inTime2: in2,
          outTime2: out2,
          hoursWorked: hoursStr,
          note: entry.note ?? null,
          updatedAt: new Date(),
        },
      });
  }

  res.json(await buildDayPayload(dateStr));
});

export default router;
