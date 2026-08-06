import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  adminSettingsTable,
  auditLogsTable,
  batchesTable,
  clustersTable,
  db,
  farmersTable,
  farmerQuantityRequestsTable,
  machinesTable,
  onboardingApplicationsTable,
  onboardingEventsTable,
  ordersTable,
  paymentReviewsTable,
  usersTable,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/session";
import { sendAdminFarmerSms } from "../lib/sms";

const router: IRouter = Router();
const paymentStatuses = ["pending", "approved", "rejected", "reconciled"] as const;
const machineStatuses = ["available", "assigned", "maintenance", "offline"] as const;

function requireAdmin(res: Parameters<typeof requireAuth>[1]): User | null {
  const user = res.locals.user as User;
  if (user.role !== "admin") {
    res.status(403).json({ message: "Only UnpackOS administrators can use the control centre" });
    return null;
  }
  return user;
}

async function audit(actorUserId: number, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await db.insert(auditLogsTable).values({ actorUserId, action, entityType, entityId, details });
}

async function getSettings() {
  const [existing] = await db.select().from(adminSettingsTable).orderBy(adminSettingsTable.id).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(adminSettingsTable).values({}).returning();
  if (!created) throw new Error("Could not create default admin settings");
  return created;
}

router.get("/admin/control-centre", requireAuth, async (_req, res, next) => {
  if (!requireAdmin(res)) return;
  try {
    const [settings, staff, farmers, clusters, batches, applications, quantityRequests, orders, machines, reviews, logs, onboardingEvents] = await Promise.all([
      getSettings(),
      db.select().from(usersTable).orderBy(usersTable.name),
      db.select().from(farmersTable),
      db.select().from(clustersTable),
      db.select().from(batchesTable).orderBy(desc(batchesTable.pickupScheduledAt)),
      db.select().from(onboardingApplicationsTable).orderBy(desc(onboardingApplicationsTable.appliedAt)),
      db.select().from(farmerQuantityRequestsTable).orderBy(desc(farmerQuantityRequestsTable.createdAt)),
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)),
      db.select().from(machinesTable).orderBy(desc(machinesTable.createdAt)),
      db.select().from(paymentReviewsTable),
      db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(60),
      db.select().from(onboardingEventsTable).orderBy(desc(onboardingEventsTable.createdAt)).limit(40),
    ]);

    const staffById = new Map(staff.map((item) => [item.id, item]));
    const farmerById = new Map(farmers.map((item) => [item.id, item]));
    const clusterById = new Map(clusters.map((item) => [item.id, item]));
    const reviewByBatch = new Map(reviews.map((item) => [item.batchId, item]));
    const now = Date.now();

    const schedules = batches.map((batch) => ({
      ...batch,
      farmerName: farmerById.get(batch.farmerId)?.name ?? "Unknown farmer",
      farmerPhone: farmerById.get(batch.farmerId)?.phone ?? "",
      clusterName: clusterById.get(batch.clusterId)?.name ?? "Unknown cluster",
      district: clusterById.get(batch.clusterId)?.district ?? "",
      operatorName: batch.assignedOperatorId ? staffById.get(batch.assignedOperatorId)?.name ?? null : null,
      aggregatorName: batch.assignedAggregatorId ? staffById.get(batch.assignedAggregatorId)?.name ?? null : null,
    }));

    const payments = schedules.map((batch) => {
      const review = reviewByBatch.get(batch.id);
      return {
        batchId: batch.id,
        passportId: batch.passportId,
        farmerName: batch.farmerName,
        farmerPhone: batch.farmerPhone,
        weightTonnes: batch.weightTonnes,
        amountInr: batch.farmerPaidInr,
        weighbridgeId: batch.weighbridgeId,
        batchStatus: batch.status,
        reviewStatus: review?.status ?? (batch.status === "paid" || batch.status === "delivered" ? "reconciled" : "pending"),
        reviewNotes: review?.notes ?? null,
        reviewedAt: review?.reviewedAt ?? null,
      };
    });

    const machineRows = machines.map((machine) => ({
      ...machine,
      ownerName: staffById.get(machine.ownerUserId)?.name ?? "Unknown partner",
      ownerPhone: staffById.get(machine.ownerUserId)?.phone ?? "",
    }));

    const alerts: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; detail: string; href?: string }> = [];
    const pendingApplications = applications.filter((item) => !["approved", "rejected"].includes(item.status));
    if (pendingApplications.length) alerts.push({ id: "applications", severity: "medium", title: `${pendingApplications.length} applications need attention`, detail: "Review farmer and partner onboarding requests.", href: "/dispatch" });
    const missedPickups = schedules.filter((batch) => batch.pickupScheduledAt && new Date(batch.pickupScheduledAt).getTime() < now && ["registered", "baled"].includes(batch.status));
    if (missedPickups.length) alerts.push({ id: "missed-pickups", severity: "high", title: `${missedPickups.length} pickups are overdue`, detail: "Contact the assigned operator before applying any buyer penalty." });
    const pendingPayments = payments.filter((item) => item.reviewStatus === "pending");
    if (pendingPayments.length) alerts.push({ id: "payments", severity: "high", title: `${pendingPayments.length} farmer payments await review`, detail: "Match weighbridge records before approving payment." });
    const unavailableMachines = machineRows.filter((item) => item.status === "maintenance" || item.status === "offline");
    if (unavailableMachines.length) alerts.push({ id: "machines", severity: "medium", title: `${unavailableMachines.length} machine units are unavailable`, detail: "Reassign affected pickup work." });
    if (!alerts.length) alerts.push({ id: "clear", severity: "low", title: "No urgent exceptions", detail: "Operations are inside the current control limits." });

    const clusterReports = clusters.map((cluster) => {
      const clusterBatches = batches.filter((batch) => batch.clusterId === cluster.id);
      return {
        id: cluster.id,
        name: cluster.name,
        district: cluster.district,
        acres: cluster.acres,
        batches: clusterBatches.length,
        tonnes: clusterBatches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
        paidInr: clusterBatches.reduce((sum, batch) => sum + batch.farmerPaidInr, 0),
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      settings,
      staff: staff.map(({ googleSubject: _googleSubject, ...item }) => item),
      schedules,
      payments,
      machines: machineRows,
      applications: applications.slice(0, 30),
      quantityRequests: quantityRequests.slice(0, 30).map((request) => ({ ...request, farmerName: farmerById.get(request.farmerId)?.name ?? "Unknown farmer", requestedByName: staffById.get(request.requestedByUserId)?.name ?? "Unknown operator" })),
      orders: orders.slice(0, 30),
      alerts,
      auditLog: [
        ...logs.map((log) => ({ ...log, actorName: log.actorUserId ? staffById.get(log.actorUserId)?.name ?? "Former staff" : "System" })),
        ...onboardingEvents.map((event) => ({ id: -event.id, actorUserId: event.actorUserId, action: event.action, entityType: "onboarding_application", entityId: String(event.applicationId), details: { fromStatus: event.fromStatus, toStatus: event.toStatus, note: event.note }, createdAt: event.createdAt, actorName: event.actorUserId ? staffById.get(event.actorUserId)?.name ?? "Former staff" : "System" })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60),
      reports: {
        clusters: clusterReports,
        totalTonnes: batches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
        totalFarmerPaidInr: batches.reduce((sum, batch) => sum + batch.farmerPaidInr, 0),
        deliveredBatches: batches.filter((batch) => batch.status === "delivered").length,
        requestedOrders: orders.filter((order) => order.status === "requested").length,
        projectedSalesInr: batches.reduce((sum, batch) => sum + batch.weightTonnes * settings.saleRateInrPerTonne, 0),
      },
    });
  } catch (error) { next(error); }
});

router.patch("/admin/schedules/:batchId", requireAuth, async (req, res, next) => {
  const admin = requireAdmin(res);
  if (!admin) return;
  const batchId = Number(req.params.batchId);
  if (!Number.isInteger(batchId) || batchId < 1) return void res.status(400).json({ message: "Invalid batch" });
  try {
    const [current] = await db.select().from(batchesTable).where(eq(batchesTable.id, batchId)).limit(1);
    if (!current) return void res.status(404).json({ message: "Batch not found" });
    const pickupScheduledAt = req.body.pickupScheduledAt ? new Date(req.body.pickupScheduledAt) : current.pickupScheduledAt;
    if (pickupScheduledAt && Number.isNaN(pickupScheduledAt.getTime())) return void res.status(400).json({ message: "Invalid pickup date" });
    const changedLockedDate = current.pickupLockedAt && pickupScheduledAt?.getTime() !== current.pickupScheduledAt?.getTime();
    const overrideReason = typeof req.body.overrideReason === "string" ? req.body.overrideReason.trim() : "";
    if (changedLockedDate && overrideReason.length < 8) return void res.status(409).json({ message: "This pickup date is locked. Enter an override reason for the audit log." });

    const assignedOperatorId = req.body.assignedOperatorId === null ? null : Number(req.body.assignedOperatorId ?? current.assignedOperatorId);
    const assignedAggregatorId = req.body.assignedAggregatorId === null ? null : Number(req.body.assignedAggregatorId ?? current.assignedAggregatorId);
    const [updated] = await db.update(batchesTable).set({
      pickupScheduledAt,
      pickupLockedAt: current.pickupLockedAt ?? (pickupScheduledAt ? new Date() : null),
      pickupNotes: typeof req.body.pickupNotes === "string" ? req.body.pickupNotes.trim() || null : current.pickupNotes,
      assignedOperatorId: Number.isInteger(assignedOperatorId) ? assignedOperatorId : null,
      assignedAggregatorId: Number.isInteger(assignedAggregatorId) ? assignedAggregatorId : null,
    }).where(eq(batchesTable.id, batchId)).returning();
    await audit(admin.id, changedLockedDate ? "pickup_date_overridden" : "pickup_schedule_updated", "batch", String(batchId), { previousDate: current.pickupScheduledAt, newDate: pickupScheduledAt, overrideReason });
    res.json(updated);
  } catch (error) { next(error); }
});

router.post("/admin/payments/:batchId/review", requireAuth, async (req, res, next) => {
  const admin = requireAdmin(res);
  if (!admin) return;
  const batchId = Number(req.params.batchId);
  const status = typeof req.body.status === "string" && paymentStatuses.includes(req.body.status) ? req.body.status : null;
  if (!Number.isInteger(batchId) || !status) return void res.status(400).json({ message: "Invalid payment review" });
  const notes = typeof req.body.notes === "string" ? req.body.notes.trim() || null : null;
  try {
    const [batch] = await db.select().from(batchesTable).where(eq(batchesTable.id, batchId)).limit(1);
    if (!batch) return void res.status(404).json({ message: "Batch not found" });
    const now = new Date();
    const [review] = await db.insert(paymentReviewsTable).values({ batchId, status, reviewedByUserId: admin.id, notes, reviewedAt: now, reconciledAt: status === "reconciled" ? now : null }).onConflictDoUpdate({
      target: paymentReviewsTable.batchId,
      set: { status, reviewedByUserId: admin.id, notes, reviewedAt: now, reconciledAt: status === "reconciled" ? now : null },
    }).returning();
    if ((status === "approved" || status === "reconciled") && batch.status !== "delivered") await db.update(batchesTable).set({ status: "paid" }).where(eq(batchesTable.id, batchId));
    await audit(admin.id, `payment_${status}`, "batch", String(batchId), { amountInr: batch.farmerPaidInr, notes });
    res.json(review);
  } catch (error) { next(error); }
});

router.patch("/admin/machines/:machineId", requireAuth, async (req, res, next) => {
  const admin = requireAdmin(res);
  if (!admin) return;
  const machineId = Number(req.params.machineId);
  const status = typeof req.body.status === "string" && machineStatuses.includes(req.body.status) ? req.body.status : undefined;
  if (!Number.isInteger(machineId) || (!status && req.body.rateInrPerDay === undefined && req.body.lastServiceAt === undefined)) return void res.status(400).json({ message: "Invalid machine update" });
  try {
    const [current] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId)).limit(1);
    if (!current) return void res.status(404).json({ message: "Machine record not found" });
    const lastServiceAt = req.body.lastServiceAt ? new Date(req.body.lastServiceAt) : current.lastServiceAt;
    const rateInrPerDay = req.body.rateInrPerDay === null ? null : Number(req.body.rateInrPerDay ?? current.rateInrPerDay);
    const [updated] = await db.update(machinesTable).set({ status: status ?? current.status, rateInrPerDay: Number.isFinite(rateInrPerDay) ? rateInrPerDay : null, lastServiceAt }).where(eq(machinesTable.id, machineId)).returning();
    await audit(admin.id, "machine_updated", "machine", String(machineId), { status: updated?.status, rateInrPerDay: updated?.rateInrPerDay });
    res.json(updated);
  } catch (error) { next(error); }
});

router.patch("/admin/settings", requireAuth, async (req, res, next) => {
  const admin = requireAdmin(res);
  if (!admin) return;
  try {
    const current = await getSettings();
    const values = {
      seasonName: typeof req.body.seasonName === "string" ? req.body.seasonName.trim() || current.seasonName : current.seasonName,
      seasonTargetTonnes: Number(req.body.seasonTargetTonnes ?? current.seasonTargetTonnes),
      farmerRateInrPerTonne: Number(req.body.farmerRateInrPerTonne ?? current.farmerRateInrPerTonne),
      saleRateInrPerTonne: Number(req.body.saleRateInrPerTonne ?? current.saleRateInrPerTonne),
      commissionPct: Number(req.body.commissionPct ?? current.commissionPct),
      pickupPenaltyInr: Number(req.body.pickupPenaltyInr ?? current.pickupPenaltyInr),
      updatedByUserId: admin.id,
      updatedAt: new Date(),
    };
    if ([values.seasonTargetTonnes, values.farmerRateInrPerTonne, values.saleRateInrPerTonne, values.commissionPct, values.pickupPenaltyInr].some((value) => !Number.isFinite(value) || value < 0)) return void res.status(400).json({ message: "Settings must contain valid positive numbers" });
    const [updated] = await db.update(adminSettingsTable).set(values).where(eq(adminSettingsTable.id, current.id)).returning();
    await audit(admin.id, "settings_updated", "admin_settings", String(current.id), values);
    res.json(updated);
  } catch (error) { next(error); }
});

router.post("/admin/sms/:batchId", requireAuth, async (req, res, next) => {
  const admin = requireAdmin(res);
  if (!admin) return;
  const batchId = Number(req.params.batchId);
  const kind = req.body.kind === "pickup" || req.body.kind === "payment" || req.body.kind === "registration" ? req.body.kind : "pickup";
  const shouldSend = req.body.send === true;
  try {
    const [row] = await db.select({ batch: batchesTable, farmer: farmersTable }).from(batchesTable).innerJoin(farmersTable, eq(batchesTable.farmerId, farmersTable.id)).where(eq(batchesTable.id, batchId)).limit(1);
    if (!row) return void res.status(404).json({ message: "Batch not found" });
    const pickup = row.batch.pickupScheduledAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(row.batch.pickupScheduledAt) : "to be confirmed";
    const message = kind === "payment"
      ? `UnpackOS: Your payment of ₹${new Intl.NumberFormat("en-IN").format(row.batch.farmerPaidInr)} for ${row.batch.weightTonnes} tonnes has been recorded. Receipt: ${(process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "")}/r/${row.batch.id}?lang=pa`
      : kind === "registration"
        ? `UnpackOS: Your stubble collection is registered. Our field operator will contact you shortly.`
        : `UnpackOS: Pickup for your stubble is confirmed for ${pickup}. The confirmed date cannot be changed; a missed pickup may attract a ₹15,000 charge.`;
    if (shouldSend) await sendAdminFarmerSms({ phone: row.farmer.phone, kind, message });
    await audit(admin.id, shouldSend ? "farmer_sms_sent" : "farmer_sms_previewed", "batch", String(batchId), { kind, phone: row.farmer.phone });
    res.json({ message, phone: row.farmer.phone, sent: shouldSend });
  } catch (error) { next(error); }
});

export default router;
