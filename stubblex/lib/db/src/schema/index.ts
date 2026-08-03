import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const batchStatusEnum = pgEnum("batch_status", [
  "registered",
  "baled",
  "paid",
  "delivered",
]);

export const leadRoleEnum = pgEnum("lead_role", [
  "farmer",
  "buyer",
  "operator",
]);

export const userRoleEnum = pgEnum("user_role", [
  "operator",
  "aggregator",
  "coordinator",
  "admin",
]);

export const lotStatusEnum = pgEnum("lot_status", [
  "available",
  "requested",
  "committed",
  "sold",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "requested",
  "confirmed",
  "rejected",
  "delivered",
]);

export const industryTypeEnum = pgEnum("industry_type", [
  "CBG",
  "pellet",
  "boiler",
  "board",
  "other",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const otpCodesTable = pgTable(
  "otp_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumed: boolean("consumed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("otp_codes_phone_created_idx").on(table.phone, table.createdAt)],
);

export const clustersTable = pgTable(
  "clusters",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    district: text("district").notNull(),
    acres: integer("acres").notNull(),
  },
  (table) => [uniqueIndex("clusters_name_district_idx").on(table.name, table.district)],
);

export const farmersTable = pgTable(
  "farmers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    fpoName: text("fpo_name").notNull(),
    clusterId: integer("cluster_id")
      .notNull()
      .references(() => clustersTable.id, { onDelete: "restrict" }),
  },
  (table) => [uniqueIndex("farmers_name_cluster_idx").on(table.name, table.clusterId)],
);

export const batchesTable = pgTable("batches", {
  id: serial("id").primaryKey(),
  passportId: text("passport_id").notNull().unique(),
  clusterId: integer("cluster_id")
    .notNull()
    .references(() => clustersTable.id, { onDelete: "restrict" }),
  farmerId: integer("farmer_id")
    .notNull()
    .references(() => farmersTable.id, { onDelete: "restrict" }),
  assignedOperatorId: integer("assigned_operator_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  weightTonnes: numeric("weight_tonnes", { precision: 7, scale: 2, mode: "number" }).notNull(),
  moisturePct: numeric("moisture_pct", { precision: 4, scale: 1, mode: "number" }).notNull(),
  baledAt: timestamp("baled_at", { withTimezone: true }).notNull(),
  weighbridgeId: text("weighbridge_id").notNull(),
  farmerPaidInr: integer("farmer_paid_inr").notNull(),
  buyerName: text("buyer_name").notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  distanceKm: integer("distance_km").notNull(),
  status: batchStatusEnum("status").notNull().default("registered"),
});

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: leadRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const yardsTable = pgTable("yards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  district: text("district").notNull(),
  lat: numeric("lat", { precision: 9, scale: 6, mode: "number" }).notNull(),
  lng: numeric("lng", { precision: 9, scale: 6, mode: "number" }).notNull(),
});

export const lotsTable = pgTable("lots", {
  id: text("id").primaryKey(),
  yardId: integer("yard_id").notNull().references(() => yardsTable.id, { onDelete: "restrict" }),
  clusterId: integer("cluster_id").notNull().references(() => clustersTable.id, { onDelete: "restrict" }),
  tonnes: numeric("tonnes", { precision: 8, scale: 2, mode: "number" }).notNull(),
  moisturePct: numeric("moisture_pct", { precision: 4, scale: 1, mode: "number" }).notNull(),
  priceInrPerTonne: integer("price_inr_per_tonne").notNull(),
  status: lotStatusEnum("status").notNull().default("available"),
  listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
  label: text("label"),
});

export const lotBatchesTable = pgTable(
  "lot_batches",
  {
    id: serial("id").primaryKey(),
    lotId: text("lot_id").notNull().references(() => lotsTable.id, { onDelete: "cascade" }),
    batchId: integer("batch_id").notNull().references(() => batchesTable.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("lot_batches_lot_batch_idx").on(table.lotId, table.batchId)],
);

export const commitmentRequestsTable = pgTable("commitment_requests", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  industryType: industryTypeEnum("industry_type").notNull(),
  volumeTonnes: numeric("volume_tonnes", { precision: 9, scale: 2, mode: "number" }).notNull(),
  preferredWindow: text("preferred_window").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  lotId: text("lot_id").notNull().references(() => lotsTable.id, { onDelete: "restrict" }),
  company: text("company").notNull(),
  phone: text("phone").notNull(),
  tonnes: numeric("tonnes", { precision: 8, scale: 2, mode: "number" }).notNull(),
  status: orderStatusEnum("status").notNull().default("requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clustersRelations = relations(clustersTable, ({ many }) => ({
  farmers: many(farmersTable),
  batches: many(batchesTable),
  lots: many(lotsTable),
}));

export const farmersRelations = relations(farmersTable, ({ one, many }) => ({
  cluster: one(clustersTable, {
    fields: [farmersTable.clusterId],
    references: [clustersTable.id],
  }),
  batches: many(batchesTable),
}));

export const batchesRelations = relations(batchesTable, ({ one, many }) => ({
  cluster: one(clustersTable, {
    fields: [batchesTable.clusterId],
    references: [clustersTable.id],
  }),
  farmer: one(farmersTable, {
    fields: [batchesTable.farmerId],
    references: [farmersTable.id],
  }),
  assignedOperator: one(usersTable, {
    fields: [batchesTable.assignedOperatorId],
    references: [usersTable.id],
  }),
  lotLinks: many(lotBatchesTable),
}));

export const usersRelations = relations(usersTable, ({ many }) => ({
  assignedBatches: many(batchesTable),
}));

export const yardsRelations = relations(yardsTable, ({ many }) => ({ lots: many(lotsTable) }));
export const lotsRelations = relations(lotsTable, ({ one, many }) => ({
  yard: one(yardsTable, { fields: [lotsTable.yardId], references: [yardsTable.id] }),
  cluster: one(clustersTable, { fields: [lotsTable.clusterId], references: [clustersTable.id] }),
  orders: many(ordersTable),
  batchLinks: many(lotBatchesTable),
}));
export const ordersRelations = relations(ordersTable, ({ one }) => ({
  lot: one(lotsTable, { fields: [ordersTable.lotId], references: [lotsTable.id] }),
}));
export const lotBatchesRelations = relations(lotBatchesTable, ({ one }) => ({
  lot: one(lotsTable, { fields: [lotBatchesTable.lotId], references: [lotsTable.id] }),
  batch: one(batchesTable, { fields: [lotBatchesTable.batchId], references: [batchesTable.id] }),
}));

export const insertClusterSchema = createInsertSchema(clustersTable).omit({ id: true });
export const insertFarmerSchema = createInsertSchema(farmersTable).omit({ id: true });
export const insertBatchSchema = createInsertSchema(batchesTable).omit({ id: true });
export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true,
  createdAt: true,
});
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertOtpCodeSchema = createInsertSchema(otpCodesTable).omit({ id: true, createdAt: true });
export const insertYardSchema = createInsertSchema(yardsTable).omit({ id: true });
export const insertLotSchema = createInsertSchema(lotsTable);
export const insertLotBatchSchema = createInsertSchema(lotBatchesTable).omit({ id: true });
export const insertCommitmentRequestSchema = createInsertSchema(commitmentRequestsTable).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Cluster = typeof clustersTable.$inferSelect;
export type InsertCluster = z.infer<typeof insertClusterSchema>;
export type Farmer = typeof farmersTable.$inferSelect;
export type InsertFarmer = z.infer<typeof insertFarmerSchema>;
export type Batch = typeof batchesTable.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type OtpCode = typeof otpCodesTable.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type Yard = typeof yardsTable.$inferSelect;
export type InsertYard = z.infer<typeof insertYardSchema>;
export type Lot = typeof lotsTable.$inferSelect;
export type InsertLot = z.infer<typeof insertLotSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type CommitmentRequest = typeof commitmentRequestsTable.$inferSelect;
export type InsertCommitmentRequest = z.infer<typeof insertCommitmentRequestSchema>;
