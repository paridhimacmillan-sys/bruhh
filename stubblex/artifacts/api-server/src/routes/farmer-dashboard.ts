import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  batchesTable,
  clustersTable,
  db,
  farmerCallbackRequestsTable,
  farmersTable,
  usersTable,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/session";

const router: IRouter = Router();
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function cleanToken(value: unknown): string | null {
  return typeof value === "string" && TOKEN_PATTERN.test(value) ? value : null;
}

async function findFarmerByToken(token: string) {
  const [record] = await db
    .select({
      id: farmersTable.id,
      name: farmersTable.name,
      phone: farmersTable.phone,
      fpoName: farmersTable.fpoName,
      listedTonnes: farmersTable.listedTonnes,
      clusterName: clustersTable.name,
      district: clustersTable.district,
      assignedOperatorId: farmersTable.assignedOperatorId,
      operatorName: usersTable.name,
      operatorPhone: usersTable.phone,
    })
    .from(farmersTable)
    .innerJoin(clustersTable, eq(farmersTable.clusterId, clustersTable.id))
    .leftJoin(usersTable, eq(farmersTable.assignedOperatorId, usersTable.id))
    .where(eq(farmersTable.accessToken, token))
    .limit(1);
  return record ?? null;
}

router.get("/farmer-dashboard/:token", async (req, res, next) => {
  const token = cleanToken(req.params.token);
  if (!token) return void res.status(404).json({ message: "Farmer dashboard not found" });
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const farmer = await findFarmerByToken(token);
    if (!farmer) return void res.status(404).json({ message: "Farmer dashboard not found" });

    const [batches, pendingCallback] = await Promise.all([
      db.select({
        id: batchesTable.id,
        status: batchesTable.status,
        weightTonnes: batchesTable.weightTonnes,
        farmerPaidInr: batchesTable.farmerPaidInr,
        pickupScheduledAt: batchesTable.pickupScheduledAt,
        baledAt: batchesTable.baledAt,
        weighbridgeId: batchesTable.weighbridgeId,
      }).from(batchesTable).where(eq(batchesTable.farmerId, farmer.id)).orderBy(desc(batchesTable.baledAt)),
      db.select({ id: farmerCallbackRequestsTable.id, additionalTonnes: farmerCallbackRequestsTable.additionalTonnes, createdAt: farmerCallbackRequestsTable.createdAt })
        .from(farmerCallbackRequestsTable)
        .where(and(eq(farmerCallbackRequestsTable.farmerId, farmer.id), eq(farmerCallbackRequestsTable.status, "pending")))
        .orderBy(desc(farmerCallbackRequestsTable.createdAt))
        .limit(1),
    ]);

    res.json({
      farmer: {
        name: farmer.name,
        fpoName: farmer.fpoName,
        listedTonnes: farmer.listedTonnes,
        clusterName: farmer.clusterName,
        district: farmer.district,
      },
      operator: farmer.operatorName && farmer.operatorPhone ? { name: farmer.operatorName, phone: farmer.operatorPhone } : null,
      batches,
      totalCollectedTonnes: batches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
      totalPaidInr: batches.reduce((sum, batch) => sum + batch.farmerPaidInr, 0),
      pendingCallback: pendingCallback[0] ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/farmer-dashboard/:token/more-stubble", async (req, res, next) => {
  const token = cleanToken(req.params.token);
  const additionalTonnes = Number(req.body?.additionalTonnes);
  if (!token) return void res.status(404).json({ message: "Farmer dashboard not found" });
  if (!Number.isFinite(additionalTonnes) || additionalTonnes < 0.1 || additionalTonnes > 500) {
    return void res.status(400).json({ message: "Enter additional tonnes between 0.1 and 500" });
  }
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const farmer = await findFarmerByToken(token);
    if (!farmer) return void res.status(404).json({ message: "Farmer dashboard not found" });
    const [pending] = await db.select({ id: farmerCallbackRequestsTable.id })
      .from(farmerCallbackRequestsTable)
      .where(and(eq(farmerCallbackRequestsTable.farmerId, farmer.id), eq(farmerCallbackRequestsTable.status, "pending")))
      .limit(1);
    if (pending) return void res.status(409).json({ message: "Your operator callback is already requested" });
    const [created] = await db.insert(farmerCallbackRequestsTable).values({ farmerId: farmer.id, additionalTonnes }).returning();
    if (!created) throw new Error("Farmer callback request creation returned no record");
    res.status(201).json({ id: created.id, additionalTonnes: created.additionalTonnes, status: created.status, createdAt: created.createdAt });
  } catch (error) {
    next(error);
  }
});

router.get("/farmer-callback-requests", requireAuth, async (_req, res, next) => {
  const user = res.locals.user as User;
  if (user.role !== "operator" && user.role !== "coordinator" && user.role !== "admin") {
    return void res.status(403).json({ message: "Farmer callback requests are limited to field operations staff" });
  }
  try {
    let query = db.select({
      id: farmerCallbackRequestsTable.id,
      farmerName: farmersTable.name,
      farmerPhone: farmersTable.phone,
      additionalTonnes: farmerCallbackRequestsTable.additionalTonnes,
      status: farmerCallbackRequestsTable.status,
      createdAt: farmerCallbackRequestsTable.createdAt,
      assignedOperatorId: farmersTable.assignedOperatorId,
    }).from(farmerCallbackRequestsTable).innerJoin(farmersTable, eq(farmerCallbackRequestsTable.farmerId, farmersTable.id)).$dynamic();
    if (user.role === "operator") query = query.where(eq(farmersTable.assignedOperatorId, user.id));
    res.json(await query.orderBy(desc(farmerCallbackRequestsTable.createdAt)));
  } catch (error) {
    next(error);
  }
});

router.patch("/farmer-callback-requests/:requestId", requireAuth, async (req, res, next) => {
  const user = res.locals.user as User;
  const requestId = Number(req.params.requestId);
  const status = req.body?.status === "contacted" || req.body?.status === "resolved" ? req.body.status as "contacted" | "resolved" : null;
  if (user.role !== "operator" && user.role !== "coordinator" && user.role !== "admin") return void res.status(403).json({ message: "Not permitted" });
  if (!Number.isInteger(requestId) || requestId < 1 || !status) return void res.status(400).json({ message: "Invalid callback update" });
  try {
    const [record] = await db.select({ request: farmerCallbackRequestsTable, assignedOperatorId: farmersTable.assignedOperatorId })
      .from(farmerCallbackRequestsTable)
      .innerJoin(farmersTable, eq(farmerCallbackRequestsTable.farmerId, farmersTable.id))
      .where(eq(farmerCallbackRequestsTable.id, requestId)).limit(1);
    if (!record) return void res.status(404).json({ message: "Callback request not found" });
    if (user.role === "operator" && record.assignedOperatorId !== user.id) return void res.status(403).json({ message: "This farmer is assigned to another operator" });
    const now = new Date();
    const [updated] = await db.update(farmerCallbackRequestsTable).set({
      status,
      contactedAt: status === "contacted" ? now : record.request.contactedAt,
      resolvedAt: status === "resolved" ? now : null,
    }).where(eq(farmerCallbackRequestsTable.id, requestId)).returning();
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
