import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  ListOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import {
  batchesTable,
  db,
  lotBatchesTable,
  lotsTable,
  ordersTable,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/session";

const router: IRouter = Router();

async function orderRecords() {
  const rows = await db
    .select({ order: ordersTable, lotTonnes: lotsTable.tonnes })
    .from(ordersTable)
    .innerJoin(lotsTable, eq(ordersTable.lotId, lotsTable.id))
    .orderBy(desc(ordersTable.createdAt));
  return rows.map(({ order, lotTonnes }) => ({ ...order, lotTonnes }));
}

router.get("/orders", requireAuth, async (_req, res, next) => {
  try {
    res.json(ListOrdersResponse.parse(await orderRecords()));
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:orderId/status", requireAuth, async (req, res, next) => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Invalid order update" });

  const user = res.locals.user as User;
  if (user.role !== "admin" && user.role !== "coordinator") {
    return void res.status(403).json({ message: "Only coordinators can decide orders" });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ order: ordersTable, lotTonnes: lotsTable.tonnes })
        .from(ordersTable)
        .innerJoin(lotsTable, eq(ordersTable.lotId, lotsTable.id))
        .where(eq(ordersTable.id, params.data.orderId))
        .limit(1);
      if (!row) return null;

      if (body.data.status === "delivered" && row.order.status !== "confirmed") {
        return { error: "Confirm the order before marking it delivered" } as const;
      }

      const [updated] = await tx
        .update(ordersTable)
        .set({ status: body.data.status, updatedAt: new Date() })
        .where(eq(ordersTable.id, row.order.id))
        .returning();

      const allOrders = await tx.select().from(ordersTable).where(eq(ordersTable.lotId, row.order.lotId));
      const confirmed = allOrders.filter((order) => order.status === "confirmed").reduce((sum, order) => sum + order.tonnes, 0);
      const delivered = allOrders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + order.tonnes, 0);
      const active = allOrders.some((order) => order.status === "requested" || order.status === "confirmed");
      const lotStatus = delivered >= row.lotTonnes ? "sold" : confirmed >= row.lotTonnes ? "committed" : active ? "requested" : "available";
      await tx.update(lotsTable).set({ status: lotStatus }).where(eq(lotsTable.id, row.order.lotId));

      if (body.data.status === "delivered") {
        const linked = await tx.select().from(lotBatchesTable).where(eq(lotBatchesTable.lotId, row.order.lotId));
        for (const link of linked) {
          await tx.update(batchesTable).set({
            buyerName: row.order.company,
            status: "delivered",
            deliveredAt: new Date(),
          }).where(eq(batchesTable.id, link.batchId));
        }
      }

      return { order: { ...updated, lotTonnes: row.lotTonnes } } as const;
    });

    if (!result) return void res.status(404).json({ message: "Order not found" });
    if ("error" in result) return void res.status(409).json({ message: result.error });
    res.json(UpdateOrderStatusResponse.parse(result.order));
  } catch (error) {
    next(error);
  }
});

export default router;
