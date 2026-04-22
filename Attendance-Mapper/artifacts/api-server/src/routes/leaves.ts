import { Router, type IRouter } from "express";
import { db, leavesTable, employeesTable, departmentsTable } from "@workspace/db";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  CreateLeaveBody,
  UpdateLeaveStatusBody,
  UpdateLeaveStatusParams,
  DeleteLeaveParams,
  ListLeavesQueryParams,
  GetLeaveBalanceParams,
} from "@workspace/api-zod";
import { computeLeaveBalance } from "./employees";

const router: IRouter = Router();

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  return Math.floor((e - s) / 86400000) + 1;
}

router.get("/leaves", async (req, res) => {
  const q = ListLeavesQueryParams.parse(req.query);
  const conds = [];
  if (q.status) conds.push(eq(leavesTable.status, q.status));
  if (q.employeeId !== undefined) conds.push(eq(leavesTable.employeeId, q.employeeId));
  const rows = await db
    .select({
      id: leavesTable.id,
      employeeId: leavesTable.employeeId,
      employeeCode: employeesTable.employeeCode,
      employeeName: employeesTable.name,
      departmentName: departmentsTable.name,
      leaveType: leavesTable.leaveType,
      startDate: leavesTable.startDate,
      endDate: leavesTable.endDate,
      reason: leavesTable.reason,
      status: leavesTable.status,
      createdAt: leavesTable.createdAt,
    })
    .from(leavesTable)
    .innerJoin(employeesTable, eq(employeesTable.id, leavesTable.employeeId))
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(leavesTable.createdAt));
  res.json(
    rows.map((r) => ({
      ...r,
      days: daysBetween(r.startDate, r.endDate),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/leaves", async (req, res) => {
  const body = CreateLeaveBody.parse(req.body);
  const startStr = fmt(body.startDate);
  const endStr = fmt(body.endDate);
  const [row] = await db
    .insert(leavesTable)
    .values({
      employeeId: body.employeeId,
      leaveType: body.leaveType,
      startDate: startStr,
      endDate: endStr,
      reason: body.reason ?? null,
      status: "pending",
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
    days: daysBetween(row.startDate, row.endDate),
    createdAt: row.createdAt.toISOString(),
    employeeCode: meta?.employeeCode ?? "",
    employeeName: meta?.employeeName ?? "",
    departmentName: meta?.departmentName ?? "",
  });
});

router.patch("/leaves/:leaveId", async (req, res) => {
  const { leaveId } = UpdateLeaveStatusParams.parse({ leaveId: Number(req.params["leaveId"]) });
  const body = UpdateLeaveStatusBody.parse(req.body);
  const [row] = await db
    .update(leavesTable)
    .set({ status: body.status })
    .where(eq(leavesTable.id, leaveId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  const [meta] = await db
    .select({
      employeeCode: employeesTable.employeeCode,
      employeeName: employeesTable.name,
      departmentName: departmentsTable.name,
    })
    .from(employeesTable)
    .innerJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, row.employeeId));
  res.json({
    ...row,
    days: daysBetween(row.startDate, row.endDate),
    createdAt: row.createdAt.toISOString(),
    employeeCode: meta?.employeeCode ?? "",
    employeeName: meta?.employeeName ?? "",
    departmentName: meta?.departmentName ?? "",
  });
});

router.delete("/leaves/:leaveId", async (req, res) => {
  const { leaveId } = DeleteLeaveParams.parse({ leaveId: Number(req.params["leaveId"]) });
  await db.delete(leavesTable).where(eq(leavesTable.id, leaveId));
  res.status(204).send();
});

router.get("/leaves/balance/:employeeId", async (req, res) => {
  const { employeeId } = GetLeaveBalanceParams.parse({ employeeId: Number(req.params["employeeId"]) });
  const balance = await computeLeaveBalance(employeeId);
  res.json(balance);
});

export default router;
