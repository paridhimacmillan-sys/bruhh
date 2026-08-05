import { Router, type IRouter } from "express";
import { desc, eq, or } from "drizzle-orm";
import {
  batchesTable,
  db,
  machinesTable,
  onboardingApplicationsTable,
  onboardingInspectionsTable,
  ordersTable,
  usersTable,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/session";

const router: IRouter = Router();
const roles = ["admin", "coordinator", "inspector", "operator", "aggregator"] as const;
type StaffRole = (typeof roles)[number];

function publicStaff(user: typeof usersTable.$inferSelect) {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt };
}

function isAdmin(res: Parameters<typeof requireAuth>[1]): User | null {
  const user = res.locals.user as User;
  if (user.role !== "admin") {
    res.status(403).json({ message: "Only UnpackOS administrators can manage staff" });
    return null;
  }
  return user;
}

function cleanEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanPhone(value: unknown): string {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

function cleanRole(value: unknown): StaffRole | null {
  return typeof value === "string" && roles.includes(value as StaffRole) ? value as StaffRole : null;
}

router.get("/staff", requireAuth, async (_req, res, next) => {
  if (!isAdmin(res)) return;
  try {
    const staff = await db.select().from(usersTable).orderBy(usersTable.name);
    res.json(staff.map(publicStaff));
  } catch (error) { next(error); }
});

router.post("/staff", requireAuth, async (req, res, next) => {
  if (!isAdmin(res)) return;
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = cleanEmail(req.body.email);
  const phone = cleanPhone(req.body.phone);
  const role = cleanRole(req.body.role);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[6-9]\d{9}$/.test(phone) || !role) {
    return void res.status(400).json({ message: "Enter a name, valid Google email, 10-digit Indian phone number, and staff role" });
  }
  try {
    const [duplicate] = await db.select().from(usersTable).where(or(eq(usersTable.email, email), eq(usersTable.phone, phone))).limit(1);
    if (duplicate) return void res.status(409).json({ message: duplicate.email === email ? "That Google email is already registered" : "That phone number is already registered" });
    const [created] = await db.insert(usersTable).values({ name, email, phone, role, active: true }).returning();
    if (!created) throw new Error("Staff account creation returned no record");
    res.status(201).json(publicStaff(created));
  } catch (error) { next(error); }
});

router.patch("/staff/:staffId", requireAuth, async (req, res, next) => {
  const admin = isAdmin(res);
  if (!admin) return;
  const staffId = Number(req.params.staffId);
  if (!Number.isInteger(staffId) || staffId < 1) return void res.status(400).json({ message: "Invalid staff member" });
  try {
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, staffId)).limit(1);
    if (!current) return void res.status(404).json({ message: "Staff member not found" });
    const role = req.body.role === undefined ? current.role : cleanRole(req.body.role);
    const active = typeof req.body.active === "boolean" ? req.body.active : current.active;
    if (!role) return void res.status(400).json({ message: "Invalid staff role" });
    if (current.id === admin.id && (role !== "admin" || !active)) return void res.status(409).json({ message: "You cannot remove or deactivate your own admin access" });
    const [updated] = await db.update(usersTable).set({ role, active }).where(eq(usersTable.id, staffId)).returning();
    if (!updated) throw new Error("Staff update returned no record");
    res.json(publicStaff(updated));
  } catch (error) { next(error); }
});

router.get("/role-dashboard", requireAuth, async (_req, res, next) => {
  const user = res.locals.user as User;
  try {
    if (user.role === "admin" || user.role === "coordinator") {
      const [staff, applications, batches, orders] = await Promise.all([
        db.select().from(usersTable),
        db.select().from(onboardingApplicationsTable),
        db.select().from(batchesTable),
        db.select().from(ordersTable),
      ]);
      return void res.json({
        role: user.role,
        staffCount: staff.filter((item) => item.active).length,
        pendingApplications: applications.filter((item) => !["approved", "rejected"].includes(item.status)).length,
        totalTonnes: batches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
        farmerPaidInr: batches.reduce((sum, batch) => sum + batch.farmerPaidInr, 0),
        deliveredBatches: batches.filter((batch) => batch.status === "delivered").length,
        requestedOrders: orders.filter((order) => order.status === "requested").length,
      });
    }
    if (user.role === "inspector") {
      const [applications, inspections] = await Promise.all([
        db.select().from(onboardingApplicationsTable).orderBy(desc(onboardingApplicationsTable.appliedAt)),
        db.select().from(onboardingInspectionsTable).where(eq(onboardingInspectionsTable.inspectorUserId, user.id)),
      ]);
      return void res.json({
        role: user.role,
        openApplications: applications.filter((item) => !["approved", "rejected"].includes(item.status)).length,
        completedInspections: inspections.length,
        recommendedInspections: inspections.filter((item) => item.recommendation === "recommended").length,
      });
    }
    if (user.role === "operator") {
      const batches = await db.select().from(batchesTable).where(eq(batchesTable.assignedOperatorId, user.id));
      return void res.json({
        role: user.role,
        assignedBatches: batches.length,
        assignedTonnes: batches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
        activeCollections: batches.filter((batch) => batch.status === "registered" || batch.status === "baled").length,
        completedCollections: batches.filter((batch) => batch.status === "paid" || batch.status === "delivered").length,
      });
    }
    const [machines, batches] = await Promise.all([
      db.select().from(machinesTable).where(eq(machinesTable.ownerUserId, user.id)),
      db.select().from(batchesTable).where(eq(batchesTable.assignedOperatorId, user.id)),
    ]);
    res.json({
      role: user.role,
      machines,
      machineCount: machines.reduce((sum, machine) => sum + machine.machineCount, 0),
      assignedJobs: batches.length,
      assignedTonnes: batches.reduce((sum, batch) => sum + batch.weightTonnes, 0),
      completedJobs: batches.filter((batch) => batch.status === "delivered").length,
    });
  } catch (error) { next(error); }
});

export default router;
