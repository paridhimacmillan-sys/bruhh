import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { hashPassword } from "./auth";
import {
  organizations,
  users,
  machines,
  items,
  shifts,
  operators,
  productionEntries,
  alertThresholds,
  breakdownReasons,
  machineShifts,
  type Organization,
  type User,
  type Machine,
  type Item,
  type Shift,
  type Operator,
  type ProductionEntry,
  type AlertThreshold,
  type BreakdownReason,
  type MachineShift,
  type InsertMachine,
  type InsertItem,
  type InsertShift,
  type InsertOperator,
  type InsertAlertThreshold,
  type InsertBreakdownReason,
  type HourlyEntry,
} from "@shared/schema";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
}

export const storage = {
  // ===== ORGANIZATIONS =====
  async createOrganization(name: string): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values({ name, inviteCode: generateInviteCode() })
      .returning();
    return org;
  },

  async getOrganizationById(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  },

  async getOrganizationByInviteCode(code: string): Promise<Organization | undefined> {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.inviteCode, code.toUpperCase()));
    return org;
  },

  // ===== USERS =====
  async createUser(input: {
    email: string | null;
    username: string | null;
    password: string;
    role: string;
    organizationId: number;
  }): Promise<User> {
    const hashed =
      // Allow passing through google_oauth_* placeholder passwords without re-hashing
      input.password.startsWith("google_oauth_")
        ? await hashPassword(input.password)
        : await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({ ...input, password: hashed })
      .returning();
    return user;
  },

  async getUserById(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return u;
  },

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()));
    return u;
  },

  async listOperatorUsers(orgId: number): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, "employee")));
  },

  async deleteUser(id: number, orgId: number): Promise<void> {
    await db
      .delete(users)
      .where(and(eq(users.id, id), eq(users.organizationId, orgId)));
  },

  // ===== MACHINES =====
  async getMachines(orgId: number): Promise<Machine[]> {
    return db
      .select()
      .from(machines)
      .where(eq(machines.organizationId, orgId))
      .orderBy(machines.machineNumber);
  },

  async getMachineById(id: number, orgId: number): Promise<Machine | undefined> {
    const [m] = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.organizationId, orgId)));
    return m;
  },

  async createMachine(data: InsertMachine & { organizationId: number }): Promise<Machine> {
    const [m] = await db.insert(machines).values(data).returning();
    return m;
  },

  async updateMachine(
    id: number,
    orgId: number,
    data: Partial<InsertMachine>
  ): Promise<Machine | undefined> {
    const [m] = await db
      .update(machines)
      .set(data)
      .where(and(eq(machines.id, id), eq(machines.organizationId, orgId)))
      .returning();
    return m;
  },

  async deleteMachine(id: number, orgId: number): Promise<{ softDeleted: boolean }> {
    // If any production entries reference this machine, soft-delete by marking
    // status='offline' instead of hard-deleting. Preserves historical data.
    const refs = await db
      .select({ id: productionEntries.id })
      .from(productionEntries)
      .where(
        and(
          eq(productionEntries.machineId, id),
          eq(productionEntries.organizationId, orgId)
        )
      )
      .limit(1);

    if (refs.length > 0) {
      await db
        .update(machines)
        .set({ status: "offline" })
        .where(and(eq(machines.id, id), eq(machines.organizationId, orgId)));
      return { softDeleted: true };
    }

    await db
      .delete(machines)
      .where(and(eq(machines.id, id), eq(machines.organizationId, orgId)));
    return { softDeleted: false };
  },

  // ===== ITEMS =====
  async getItems(orgId: number): Promise<Item[]> {
    return db
      .select()
      .from(items)
      .where(eq(items.organizationId, orgId))
      .orderBy(items.itemName);
  },

  async createItem(data: InsertItem & { organizationId: number }): Promise<Item> {
    const [i] = await db.insert(items).values(data).returning();
    return i;
  },

  async updateItem(
    id: number,
    orgId: number,
    data: Partial<InsertItem>
  ): Promise<Item | undefined> {
    const [i] = await db
      .update(items)
      .set(data)
      .where(and(eq(items.id, id), eq(items.organizationId, orgId)))
      .returning();
    return i;
  },

  async deleteItem(id: number, orgId: number): Promise<{ softDeleted: boolean }> {
    const refs = await db
      .select({ id: productionEntries.id })
      .from(productionEntries)
      .where(
        and(
          eq(productionEntries.itemId, id),
          eq(productionEntries.organizationId, orgId)
        )
      )
      .limit(1);

    if (refs.length > 0) {
      await db
        .update(items)
        .set({ status: "inactive" })
        .where(and(eq(items.id, id), eq(items.organizationId, orgId)));
      return { softDeleted: true };
    }

    await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.organizationId, orgId)));
    return { softDeleted: false };
  },

  // ===== SHIFTS =====
  async getShifts(orgId: number): Promise<Shift[]> {
    return db
      .select()
      .from(shifts)
      .where(eq(shifts.organizationId, orgId))
      .orderBy(shifts.startTime);
  },

  async createShift(data: InsertShift & { organizationId: number }): Promise<Shift> {
    const [s] = await db.insert(shifts).values(data).returning();
    return s;
  },

  async updateShift(
    id: number,
    orgId: number,
    data: Partial<InsertShift>
  ): Promise<Shift | undefined> {
    const [s] = await db
      .update(shifts)
      .set(data)
      .where(and(eq(shifts.id, id), eq(shifts.organizationId, orgId)))
      .returning();
    return s;
  },

  async deleteShift(id: number, orgId: number): Promise<void> {
    await db
      .delete(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.organizationId, orgId)));
  },

  // ===== OPERATORS =====
  async getOperators(orgId: number): Promise<Operator[]> {
    return db
      .select()
      .from(operators)
      .where(eq(operators.organizationId, orgId))
      .orderBy(operators.name);
  },

  async createOperator(data: InsertOperator & { organizationId: number }): Promise<Operator> {
    const [o] = await db.insert(operators).values(data).returning();
    return o;
  },

  async updateOperator(
    id: number,
    orgId: number,
    data: Partial<InsertOperator>
  ): Promise<Operator | undefined> {
    const [o] = await db
      .update(operators)
      .set(data)
      .where(and(eq(operators.id, id), eq(operators.organizationId, orgId)))
      .returning();
    return o;
  },

  async deleteOperator(id: number, orgId: number): Promise<void> {
    await db
      .delete(operators)
      .where(and(eq(operators.id, id), eq(operators.organizationId, orgId)));
  },

  // ===== PRODUCTION ENTRIES =====
  async getEntries(
    orgId: number,
    filters: { dateFrom?: string; dateTo?: string; machineId?: number; shift?: string } = {}
  ): Promise<ProductionEntry[]> {
    const conds = [eq(productionEntries.organizationId, orgId)];
    if (filters.dateFrom) conds.push(gte(productionEntries.date, filters.dateFrom));
    if (filters.dateTo) conds.push(lte(productionEntries.date, filters.dateTo));
    if (filters.machineId) conds.push(eq(productionEntries.machineId, filters.machineId));
    if (filters.shift) conds.push(eq(productionEntries.shift, filters.shift));
    return db
      .select()
      .from(productionEntries)
      .where(and(...conds))
      .orderBy(desc(productionEntries.date));
  },

  async upsertEntry(input: {
    organizationId: number;
    date: string;
    machineId: number;
    itemId: number;
    shift: string;
    openingReading: number;
    entries: HourlyEntry[];
    operatorName: string | null;
    notes: string | null;
    lockedHours: number[];
    totalActual: number;
    totalExpected: number;
    status: string;
  }): Promise<ProductionEntry> {
    // Match on (org, date, machine, item, shift). Same machine running two items
    // in the same shift = two separate entries.
    const existing = await db
      .select()
      .from(productionEntries)
      .where(
        and(
          eq(productionEntries.organizationId, input.organizationId),
          eq(productionEntries.date, input.date),
          eq(productionEntries.machineId, input.machineId),
          eq(productionEntries.itemId, input.itemId),
          eq(productionEntries.shift, input.shift)
        )
      );
    if (existing.length) {
      const [updated] = await db
        .update(productionEntries)
        .set({
          openingReading: input.openingReading,
          entries: input.entries,
          operatorName: input.operatorName,
          notes: input.notes,
          lockedHours: input.lockedHours,
          totalActual: input.totalActual,
          totalExpected: input.totalExpected,
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(productionEntries.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(productionEntries).values(input).returning();
    return created;
  },

  async deleteEntries(orgId: number, date: string, shift: string): Promise<void> {
    await db
      .delete(productionEntries)
      .where(
        and(
          eq(productionEntries.organizationId, orgId),
          eq(productionEntries.date, date),
          eq(productionEntries.shift, shift)
        )
      );
  },

  async deleteEntryById(id: number, orgId: number): Promise<void> {
    await db
      .delete(productionEntries)
      .where(
        and(
          eq(productionEntries.id, id),
          eq(productionEntries.organizationId, orgId)
        )
      );
  },

  // ===== ALERT THRESHOLDS =====
  async getAlertThresholds(orgId: number): Promise<AlertThreshold[]> {
    return db
      .select()
      .from(alertThresholds)
      .where(eq(alertThresholds.organizationId, orgId))
      .orderBy(alertThresholds.createdAt);
  },

  async createAlertThreshold(
    data: InsertAlertThreshold & { organizationId: number }
  ): Promise<AlertThreshold> {
    const [a] = await db.insert(alertThresholds).values(data).returning();
    return a;
  },

  async updateAlertThreshold(
    id: number,
    orgId: number,
    data: Partial<InsertAlertThreshold>
  ): Promise<AlertThreshold | undefined> {
    const [a] = await db
      .update(alertThresholds)
      .set(data)
      .where(and(eq(alertThresholds.id, id), eq(alertThresholds.organizationId, orgId)))
      .returning();
    return a;
  },

  async deleteAlertThreshold(id: number, orgId: number): Promise<void> {
    await db
      .delete(alertThresholds)
      .where(and(eq(alertThresholds.id, id), eq(alertThresholds.organizationId, orgId)));
  },

  // ===== BREAKDOWN REASONS =====
  async getBreakdownReasons(orgId: number): Promise<BreakdownReason[]> {
    return db
      .select()
      .from(breakdownReasons)
      .where(eq(breakdownReasons.organizationId, orgId))
      .orderBy(breakdownReasons.name);
  },

  async createBreakdownReason(
    data: InsertBreakdownReason & { organizationId: number }
  ): Promise<BreakdownReason> {
    const [r] = await db.insert(breakdownReasons).values(data).returning();
    return r;
  },

  async updateBreakdownReason(
    id: number,
    orgId: number,
    data: Partial<InsertBreakdownReason>
  ): Promise<BreakdownReason | undefined> {
    const [r] = await db
      .update(breakdownReasons)
      .set(data)
      .where(
        and(
          eq(breakdownReasons.id, id),
          eq(breakdownReasons.organizationId, orgId)
        )
      )
      .returning();
    return r;
  },

  async deleteBreakdownReason(id: number, orgId: number): Promise<void> {
    await db
      .delete(breakdownReasons)
      .where(
        and(
          eq(breakdownReasons.id, id),
          eq(breakdownReasons.organizationId, orgId)
        )
      );
  },

  // Seed common reasons for a fresh org. Idempotent — caller checks first.
  async seedBreakdownReasons(orgId: number): Promise<void> {
    const defaults = [
      "No Operator", "Tea Break", "Meeting", "No Electricity", "No Air",
      "Insert Change", "Bit Change", "Drill Change", "Tool Set Up", "Collet Change",
      "Collet Cleaning", "Chuck Greasing", "Machine Breakdown", "Machine Set Up",
      "Machine Alarm", "Hydraulic Problem", "Pressure Down", "No Material",
      "Re-Work", "Scrap Removal", "Cleaning", "Maintenance", "New Operator",
      "Process Limitation", "No Work", "Other",
    ];
    const rows = defaults.map((name) => ({
      organizationId: orgId,
      name,
      category: "general",
      status: "active",
    }));
    await db.insert(breakdownReasons).values(rows);
  },

  // ===== MACHINE-SHIFT ASSIGNMENTS =====
  // Get all assignments for an org. Client uses this to compute which
  // machines are valid for which shifts. If no rows exist for a machine,
  // it's treated as "runs in all shifts" (back-compat default).
  async getMachineShifts(orgId: number): Promise<MachineShift[]> {
    return db
      .select()
      .from(machineShifts)
      .where(eq(machineShifts.organizationId, orgId));
  },

  // Replace the entire shift-list for a single machine atomically.
  // Pass shiftIds=[] to remove all assignments (machine reverts to "all shifts").
  async setMachineShifts(
    machineId: number,
    orgId: number,
    shiftIds: number[]
  ): Promise<MachineShift[]> {
    // Delete all current rows for this machine
    await db
      .delete(machineShifts)
      .where(
        and(
          eq(machineShifts.machineId, machineId),
          eq(machineShifts.organizationId, orgId)
        )
      );
    if (shiftIds.length === 0) return [];
    const rows = shiftIds.map((shiftId) => ({
      organizationId: orgId,
      machineId,
      shiftId,
    }));
    return db.insert(machineShifts).values(rows).returning();
  },

  // ===== BULK DELETE =====
  // Each returns { deleted, softDeleted } counts. Soft-delete only applies
  // to resources with FK-dependent entries (machines, items).
  async bulkDeleteMachines(
    ids: number[],
    orgId: number
  ): Promise<{ deleted: number; softDeleted: number }> {
    let deleted = 0;
    let softDeleted = 0;
    for (const id of ids) {
      const res = await this.deleteMachine(id, orgId);
      if (res.softDeleted) softDeleted++;
      else deleted++;
    }
    return { deleted, softDeleted };
  },

  async bulkDeleteItems(
    ids: number[],
    orgId: number
  ): Promise<{ deleted: number; softDeleted: number }> {
    let deleted = 0;
    let softDeleted = 0;
    for (const id of ids) {
      const res = await this.deleteItem(id, orgId);
      if (res.softDeleted) softDeleted++;
      else deleted++;
    }
    return { deleted, softDeleted };
  },

  async bulkDeleteShifts(ids: number[], orgId: number): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    const res = await db
      .delete(shifts)
      .where(and(inArray(shifts.id, ids), eq(shifts.organizationId, orgId)))
      .returning({ id: shifts.id });
    return { deleted: res.length };
  },

  async bulkDeleteOperators(
    ids: number[],
    orgId: number
  ): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    const res = await db
      .delete(operators)
      .where(and(inArray(operators.id, ids), eq(operators.organizationId, orgId)))
      .returning({ id: operators.id });
    return { deleted: res.length };
  },

  async bulkDeleteBreakdownReasons(
    ids: number[],
    orgId: number
  ): Promise<{ deleted: number }> {
    if (ids.length === 0) return { deleted: 0 };
    const res = await db
      .delete(breakdownReasons)
      .where(
        and(
          inArray(breakdownReasons.id, ids),
          eq(breakdownReasons.organizationId, orgId)
        )
      )
      .returning({ id: breakdownReasons.id });
    return { deleted: res.length };
  },
};
