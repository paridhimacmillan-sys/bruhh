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

// Machines: shop-floor machines
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  machineNumber: text("machine_number").notNull(),
  machineType: text("machine_type").notNull(),
  targetRate: integer("target_rate").notNull().default(60),
  status: text("status").notNull().default("active"), // active / maintenance / offline
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Items: products produced on machines
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  itemName: text("item_name").notNull(),
  defaultRate: integer("default_rate").notNull().default(60),
  // per-machine rate overrides: [{ machineId: number, rate: number }]
  rates: jsonb("rates").default([]),
  status: text("status").notNull().default("active"),
  unit: text("unit").default("pcs/hr"),
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

// Production entries: one row per (date, machine, shift)
export const productionEntries = pgTable("production_entries", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id),
  date: date("date").notNull(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id),
  itemId: integer("item_id").references(() => items.id),
  shift: text("shift").notNull(),
  openingReading: integer("opening_reading").default(0),
  // entries: [{ hour: 'HH:MM', closingReading: number|null, actual: number, expected: number }]
  entries: jsonb("entries").notNull(),
  operatorName: text("operator_name"),
  notes: text("notes"),
  lockedHours: integer("locked_hours").array().default([]),
  totalActual: integer("total_actual").default(0),
  totalExpected: integer("total_expected").default(0),
  status: text("status").default("draft"), // draft / submitted / flagged
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
    targetRate: z.coerce.number().int().positive("Target rate must be positive"),
    status: z.enum(["active", "maintenance", "offline"]).default("active"),
  });

export const insertItemSchema = createInsertSchema(items)
  .omit({ id: true, organizationId: true })
  .extend({
    itemName: z.string().trim().min(1, "Item name is required"),
    defaultRate: z.coerce.number().int().positive("Default rate must be positive"),
    status: z.enum(["active", "inactive"]).default("active"),
    unit: z.string().default("pcs/hr"),
    rates: z.array(z.object({ machineId: z.number(), rate: z.number() })).default([]),
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

export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type InsertAlertThreshold = z.infer<typeof insertAlertThresholdSchema>;

// Hourly entry inside productionEntries.entries
export interface HourlyEntry {
  hour: string;
  closingReading: number | null;
  actual: number;
  expected: number;
}
