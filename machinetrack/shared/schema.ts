import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  date,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations (tenants)
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Users: admins (email/password or Google) and operators (username/password)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email"),
  username: text("username").unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("employee"),
  organizationId: integer("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Machines: shop-floor machines. Just identity — no rate, no item.
// Rates live on items as (machineId, rate) pairs.
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  machineNumber: text("machine_number").notNull(),
  machineType: text("machine_type").notNull(),
  status: text("status").notNull().default("active"), // active / maintenance / offline
  // How operators log production for this machine:
  //   'hourly'      → full hourly grid (default, existing behavior)
  //   'shift_total' → single opening + single closing per shift; target computed
  //                   from elapsed time between Save Opening and Save Closing
  //                   (rounded to nearest hour, minus lunch overlap)
  trackingMode: text("tracking_mode").notNull().default("hourly"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Items: products produced on machines.
// `rates` is the source of truth — a list of (machineId, rate) pairs that
// determines which machines the item can run on and at what speed.
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  itemName: text("item_name").notNull(),
  // Per-machine assignments. Empty array = item not assigned anywhere.
  // [{ machineId: number, rate: number }]
  rates: jsonb("rates").notNull().default([]),
  status: text("status").notNull().default("active"),
});

// Shifts: shop-floor shifts (e.g. "A", "B", "Night")
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(), // 'HH:MM'
  endTime: text("end_time").notNull(),
});

// Operators: assignable to machine rows
export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
});

// Breakdown reasons: list of standardised reasons operators can pick when
// an hour cell's actual output falls below target. Per-org so each factory
// can curate its own list.
export const breakdownReasons = pgTable("breakdown_reasons", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  // Optional category for grouping in reports
  category: text("category").default("general"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Machine-shift assignments: which machines run in which shifts. Many-to-many.
// If a machine has NO rows here, it runs in all shifts (back-compat default).
// If it has rows, it only appears in production grid for those shifts.
export const machineShifts = pgTable("machine_shifts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
});

// Standing assignment: which operator is assigned to which machine on which
// shift, as a recurring/default schedule. No date — applies every day until
// overridden by an assignmentOverride. Multiple operators per (machine, shift)
// allowed (e.g. shift handoff or two operators sharing a machine).
export const machineShiftAssignments = pgTable("machine_shift_assignments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id),
  operatorName: text("operator_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Daily override: replaces the standing assignment for a specific date+shift+
// machine. When present, the resolver uses this instead of any standing row.
// If empty (no override AND no standing row) the machine is unassigned for
// that shift.
export const assignmentOverrides = pgTable("assignment_overrides", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  date: date("date").notNull(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id),
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id),
  operatorName: text("operator_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Alert thresholds: configured rules per organization
export const alertThresholds = pgTable("alert_thresholds", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'efficiency' | 'gap' | 'idle'
  threshold: integer("threshold").notNull(), // % for efficiency, pcs for gap, minutes for idle
  scope: text("scope").notNull().default("machine"), // 'machine' | 'shift'
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Production entries: one row per (date, machine, item, shift) — same machine
// can have multiple entries per shift if it runs multiple items.
export const productionEntries = pgTable("production_entries", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  date: date("date").notNull(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  shift: text("shift").notNull(),
  openingReading: integer("opening_reading").default(0),
  // Timestamps for shift-total mode: when the operator clicked "Save Opening"
  // and "Save Closing". Used to compute elapsed productive time → target.
  // The actual click time is stored; rounding to nearest hour happens in the
  // target calculation. Null for hourly-mode entries (timestamp irrelevant).
  openingAt: timestamp("opening_at"),
  closingAt: timestamp("closing_at"),
  // entries: [{ hour: 'HH:MM', closingReading: number|null, actual: number, expected: number }]
  entries: jsonb("entries").notNull(),
  operatorName: text("operator_name"),
  // Second operator when handover happens mid-shift. Both fields go together —
  // setting one without the other is rejected at the API layer.
  operatorName2: text("operator_name_2"),
  operatorChangeTime: text("operator_change_time"), // HH:MM
  notes: text("notes"),
  lockedHours: integer("locked_hours").array().default([]),
  // Per-hour save timestamps: { "0": "2026-06-15T13:01:00Z", "1": "..." }.
  // Used to determine whether an operator can still undo a recently-saved
  // hour (within 10 minutes); admin can undo any.
  hourSavedAt: jsonb("hour_saved_at").default({}),
  totalActual: integer("total_actual").default(0),
  totalExpected: integer("total_expected").default(0),
  status: text("status").default("draft"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Zod insert schemas (for validation in API routes)
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertMachineSchema = createInsertSchema(machines)
  .omit({ id: true, createdAt: true, organizationId: true })
  .extend({
    machineNumber: z.string().trim().min(1, "Machine number is required"),
    machineType: z.string().trim().min(1, "Machine type is required"),
    status: z.enum(["active", "maintenance", "offline"]).default("active"),
  });

export const insertItemSchema = createInsertSchema(items)
  .omit({ id: true, organizationId: true })
  .extend({
    itemName: z.string().trim().min(1, "Item name is required"),
    status: z.enum(["active", "inactive"]).default("active"),
    rates: z
      .array(
        z.object({
          machineId: z.coerce.number().int().positive(),
          rate: z.coerce.number().int().positive(),
        })
      )
      .default([]),
  });

export const insertShiftSchema = createInsertSchema(shifts)
  .omit({ id: true, organizationId: true })
  .extend({
    name: z.string().trim().min(1, "Shift name is required"),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM"),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM"),
  });

export const insertOperatorSchema = createInsertSchema(operators)
  .omit({ id: true, organizationId: true })
  .extend({
    name: z.string().trim().min(1, "Operator name is required"),
  });

export const insertBreakdownReasonSchema = createInsertSchema(breakdownReasons)
  .omit({ id: true, organizationId: true, createdAt: true })
  .extend({
    name: z.string().trim().min(1, "Reason name is required"),
    category: z.string().default("general"),
    status: z.enum(["active", "inactive"]).default("active"),
  });

export const insertMachineShiftSchema = createInsertSchema(machineShifts)
  .omit({ id: true, organizationId: true })
  .extend({
    machineId: z.coerce.number().int().positive(),
    shiftId: z.coerce.number().int().positive(),
  });

export const insertAlertThresholdSchema = createInsertSchema(alertThresholds)
  .omit({ id: true, organizationId: true, createdAt: true })
  .extend({
    name: z.string().trim().min(1, "Name is required"),
    type: z.enum(["efficiency", "gap", "idle"]),
    threshold: z.coerce.number().int().min(0, "Threshold must be ≥ 0"),
    scope: z.enum(["machine", "shift"]).default("machine"),
    enabled: z.boolean().default(true),
  });

export const insertProductionEntrySchema = createInsertSchema(productionEntries).omit({
  id: true,
  organizationId: true,
  updatedAt: true,
});

// Inferred types for client + server
export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Machine = typeof machines.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type Operator = typeof operators.$inferSelect;
export type ProductionEntry = typeof productionEntries.$inferSelect;
export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type BreakdownReason = typeof breakdownReasons.$inferSelect;
export type MachineShift = typeof machineShifts.$inferSelect;

export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;
export type InsertBreakdownReason = z.infer<typeof insertBreakdownReasonSchema>;
export type InsertMachineShift = z.infer<typeof insertMachineShiftSchema>;

// Hourly entry inside productionEntries.entries.
// reasonId is the BreakdownReason picked by the operator when the hour fell
// below the efficiency threshold. NULL means no reason recorded (either the
// hour was on target, or operator hasn't filled it in yet).
export interface HourlyEntry {
  hour: string;
  closingReading: number | null;
  actual: number;
  expected: number;
  reasonId?: number | null;
}

// Per-machine rate assignment for an item
export interface ItemRate {
  machineId: number;
  rate: number;
}
