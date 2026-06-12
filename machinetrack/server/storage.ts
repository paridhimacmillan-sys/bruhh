import { eq, and, gte, lte, desc } from "drizzle-orm";
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
  type Organization,
  type User,
  type Machine,
  type Item,
  type Shift,
  type Operator,
  type ProductionEntry,
  type AlertThreshold,
  type InsertMachine,
  type InsertItem,
  type InsertShift,
  type InsertOperator,
  type InsertAlertThreshold,
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

  async deleteMachine(id: number, orgId: number): Promise<void> {
    await db
      .delete(machines)
      .where(and(eq(machines.id, id), eq(machines.organizationId, orgId)));
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

  async deleteItem(id: number, orgId: number): Promise<void> {
    await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.organizationId, orgId)));
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
    itemId: number | null;
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
    // Manual upsert because Drizzle's onConflictDoUpdate is awkward across versions
    const existing = await db
      .select()
      .from(productionEntries)
      .where(
        and(
          eq(productionEntries.organizationId, input.organizationId),
          eq(productionEntries.date, input.date),
          eq(productionEntries.machineId, input.machineId),
          eq(productionEntries.shift, input.shift)
        )
      );
    if (existing.length) {
      const [updated] = await db
        .update(productionEntries)
        .set({
          itemId: input.itemId,
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
};
