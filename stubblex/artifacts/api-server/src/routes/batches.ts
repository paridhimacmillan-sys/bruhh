import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  GetBatchParams,
  GetBatchResponse,
  GetFarmerReceiptParams,
  GetFarmerReceiptResponse,
  ListBatchesResponse,
  UpdateBatchStatusBody,
  UpdateBatchStatusResponse,
} from "@workspace/api-zod";
import { batchesTable, clustersTable, db, farmersTable, type User } from "@workspace/db";
import { requireAuth } from "../lib/session";
import { sendFarmerPaidSms } from "../lib/sms";
import { logger } from "../lib/logger";
import { writeAudit } from "../lib/audit";

const router: IRouter = Router();
const SALE_PRICE_INR_PER_TONNE = 1_700;

function toPublicBatch(batch: typeof batchesTable.$inferSelect) {
  return {
    ...batch,
    salePriceInrPerTonne: SALE_PRICE_INR_PER_TONNE,
  };
}

router.get("/batches", requireAuth, async (_req, res, next) => {
  try {
    const user = res.locals.user as User;
    const batches = user.role === "admin" || user.role === "coordinator"
      ? await db.select().from(batchesTable).orderBy(desc(batchesTable.baledAt))
      : await db
          .select()
          .from(batchesTable)
          .where(eq(batchesTable.assignedOperatorId, user.id))
          .orderBy(desc(batchesTable.baledAt));
    res.json(ListBatchesResponse.parse(batches.map(toPublicBatch)));
  } catch (error) {
    next(error);
  }
});

router.patch("/batches/:passportId/status", requireAuth, async (req, res, next) => {
  const parsedParams = GetBatchParams.safeParse(req.params);
  const parsedBody = UpdateBatchStatusBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid batch status update" });
    return;
  }

  try {
    const user = res.locals.user as User;
    if (user.role !== "admin" && user.role !== "coordinator" && user.role !== "operator") {
      return void res.status(403).json({ message: "Only field operators and UnpackOS coordinators can update collection status" });
    }
    const [record] = await db
      .select({ batch: batchesTable, farmerPhone: farmersTable.phone })
      .from(batchesTable)
      .innerJoin(farmersTable, eq(batchesTable.farmerId, farmersTable.id))
      .where(eq(batchesTable.passportId, parsedParams.data.passportId))
      .limit(1);

    if (!record) {
      res.status(404).json({ message: "Batch not found" });
      return;
    }

    const canUpdateAll = user.role === "admin" || user.role === "coordinator";
    if (!canUpdateAll && record.batch.assignedOperatorId !== user.id) {
      res.status(403).json({ message: "This batch is not assigned to you" });
      return;
    }

    const [updated] = await db
      .update(batchesTable)
      .set({ status: parsedBody.data.status })
      .where(
        and(
          eq(batchesTable.id, record.batch.id),
          eq(batchesTable.passportId, parsedParams.data.passportId),
        ),
      )
      .returning();

    if (!updated) throw new Error("Batch update returned no record");
    await writeAudit({ actorUserId: user.id, action: "batch_status_updated", entityType: "batch", entityId: updated.id, details: { passportId: updated.passportId, fromStatus: record.batch.status, toStatus: updated.status } });

    if (record.batch.status !== "paid" && updated.status === "paid" && !parsedBody.data.simulateNotification) {
      const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? `${req.protocol}://${req.get("host")}`;
      try {
        await sendFarmerPaidSms({
          phone: record.farmerPhone,
          weight: updated.weightTonnes,
          amount: updated.farmerPaidInr,
          shortlink: `${baseUrl}/r/${updated.id}?lang=pa`,
        });
      } catch (error) {
        logger.error({ error, passportId: updated.passportId }, "Farmer paid SMS failed");
      }
    }

    res.json(UpdateBatchStatusResponse.parse(toPublicBatch(updated)));
  } catch (error) {
    next(error);
  }
});

router.get("/batches/id/:batchId", async (req, res, next) => {
  const parsed = GetFarmerReceiptParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid batch ID" });
    return;
  }

  try {
    const [record] = await db
      .select({
        id: batchesTable.id,
        passportId: batchesTable.passportId,
        clusterName: clustersTable.name,
        weightTonnes: batchesTable.weightTonnes,
        farmerPaidInr: batchesTable.farmerPaidInr,
        baledAt: batchesTable.baledAt,
        weighbridgeId: batchesTable.weighbridgeId,
        status: batchesTable.status,
      })
      .from(batchesTable)
      .innerJoin(clustersTable, eq(batchesTable.clusterId, clustersTable.id))
      .where(eq(batchesTable.id, parsed.data.batchId))
      .limit(1);

    if (!record) {
      res.status(404).json({ message: "Batch not found" });
      return;
    }

    res.json(GetFarmerReceiptResponse.parse({ ...record, paymentDate: record.baledAt }));
  } catch (error) {
    next(error);
  }
});

router.get("/batches/:passportId", async (req, res, next) => {
  const parsedParams = GetBatchParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid passport ID" });
    return;
  }

  try {
    const [batch] = await db
      .select()
      .from(batchesTable)
      .where(eq(batchesTable.passportId, parsedParams.data.passportId))
      .limit(1);

    if (!batch) {
      res.status(404).json({ message: "Batch not found" });
      return;
    }

    res.json(GetBatchResponse.parse(toPublicBatch(batch)));
  } catch (error) {
    next(error);
  }
});

export default router;
