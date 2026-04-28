import { Router, type IRouter } from "express";
import { db, departmentsTable, employeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateDepartmentBody,
  DeleteDepartmentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/departments", async (_req, res) => {
  const rows = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
      code: departmentsTable.code,
      displayOrder: departmentsTable.displayOrder,
      createdAt: departmentsTable.createdAt,
      employeeCount: sql<number>`coalesce(count(${employeesTable.id}), 0)::int`,
    })
    .from(departmentsTable)
    .leftJoin(employeesTable, eq(employeesTable.departmentId, departmentsTable.id))
    .groupBy(departmentsTable.id)
    .orderBy(departmentsTable.displayOrder, departmentsTable.name);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/departments", async (req, res) => {
  const body = CreateDepartmentBody.parse(req.body);
  const [row] = await db
    .insert(departmentsTable)
    .values({
      name: body.name,
      code: body.code ?? null,
      displayOrder: body.displayOrder ?? 0,
    })
    .returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), employeeCount: 0 });
});

router.delete("/departments/:departmentId", async (req, res) => {
  const { departmentId } = DeleteDepartmentParams.parse({ departmentId: Number(req.params["departmentId"]) });
  await db.delete(departmentsTable).where(eq(departmentsTable.id, departmentId));
  res.status(204).send();
});

export default router;
