import { Router, type IRouter } from "express";
import { db, overtimeTable, employeesTable, departmentsTable } from "@workspace/db";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import {
  CreateOvertimeBody,
  DeleteOvertimeParams,
  ListOvertimeQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

router.get("/overtime", async (req, res) => {
  const q = ListOvertimeQueryParams.parse(req.query);
  const conds = [];
  if (q.month) {
    const { start, end } = monthBounds(q.month);
    conds.push(gte(overtimeTable.date, start));
    conds.push(lte(overtimeTable.date, end));
  }
  if (q.employeeId !== undefined) conds.push(eq(overtimeTable.employeeId, q.employeeId));
  const rows = await db
    .select({
      id: overtimeTable.id,
      employeeId: overtimeTable.employeeId,
      employeeCode: employeesTable.employeeCode,
      employeeName: employeesTable.name,
      departmentName: departmentsTable.name,
      date: overtimeTable.date,
      hours: overtimeTable.hours,
      reason: overtimeTable.reason,
      createdAt: overtimeTable.createdAt,
    })
    .from(overtimeTable)
    .innerJoin(employeesTable, eq(employeesTable.id, overtimeTable.employeeId))
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(overtimeTable.date));
  res.json(rows.map((r) => ({ ...r, hours: Number(r.hours), createdAt: r.createdAt.toISOString() })));
});

router.post("/overtime", async (req, res) => {
  const body = CreateOvertimeBody.parse(req.body);
  const dateStr = body.date.toISOString().slice(0, 10);
  const [row] = await db
    .insert(overtimeTable)
    .values({
      employeeId: body.employeeId,
      date: dateStr,
      hours: String(body.hours),
      reason: body.reason ?? null,
    })
    .returning();
  const [meta] = await db
    .select({
      employeeCode: employeesTable.employeeCode,
      employeeName: employeesTable.name,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, body.employeeId));
  res.status(201).json({
    ...row,
    hours: Number(row.hours),
    createdAt: row.createdAt.toISOString(),
    employeeCode: meta?.employeeCode ?? "",
    employeeName: meta?.employeeName ?? "",
    departmentName: meta?.departmentName ?? "",
  });
});

router.delete("/overtime/:overtimeId", async (req, res) => {
  const { overtimeId } = DeleteOvertimeParams.parse({ overtimeId: Number(req.params["overtimeId"]) });
  await db.delete(overtimeTable).where(eq(overtimeTable.id, overtimeId));
  res.status(204).send();
});

export default router;
