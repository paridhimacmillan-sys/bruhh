import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
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
  "inspector",
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

export const onboardingApplicantTypeEnum = pgEnum("onboarding_applicant_type", [
  "farmer",
  "machine_partner",
  "logistics_operator",
  "buyer",
]);

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "new",
  "contacted",
  "documents_pending",
  "verified",
  "approved",
  "rejected",
  "waitlisted",
]);

export const machineTypeEnum = pgEnum("machine_type", [
  "baler",
  "rake",
  "tractor",
  "loader",
  "truck",
  "other",
]);

export const inspectionRecommendationEnum = pgEnum("inspection_recommendation", [
  "recommended",
  "revisit_required",
  "not_eligible",
]);

export const quantityRequestStatusEnum = pgEnum("quantity_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const quantityChangeSourceEnum = pgEnum("quantity_change_source", [
  "revised_estimate",
  "additional_land",
  "new_field",
]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  email: text("email").unique(),
  googleSubject: text("google_subject").unique(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  active: boolean("active").notNull().default(true),
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
    assignedOperatorId: integer("assigned_operator_id").references(() => usersTable.id, { onDelete: "set null" }),
    listedTonnes: numeric("listed_tonnes", { precision: 9, scale: 2, mode: "number" }).notNull().default(0),
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

export const onboardingApplicationsTable = pgTable("onboarding_applications", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().default(sql`('STX-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)))`).unique(),
  applicantType: onboardingApplicantTypeEnum("applicant_type").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  district: text("district").notNull(),
  applicationData: jsonb("application_data").$type<Record<string, string | number | null>>().notNull().default({}),
  status: onboardingStatusEnum("status").notNull().default("new"),
  assignedCoordinatorId: integer("assigned_coordinator_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }).notNull().defaultNow(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const onboardingDocumentsTable = pgTable("onboarding_documents", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => onboardingApplicationsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  fileDataBase64: text("file_data_base64").notNull(),
  source: text("source").notNull().default("applicant"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingInspectionsTable = pgTable("onboarding_inspections", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => onboardingApplicationsTable.id, { onDelete: "cascade" }),
  inspectorUserId: integer("inspector_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  visitedAt: timestamp("visited_at", { withTimezone: true }).notNull(),
  observedAcres: numeric("observed_acres", { precision: 8, scale: 2, mode: "number" }).notNull(),
  estimatedTonnes: numeric("estimated_tonnes", { precision: 8, scale: 2, mode: "number" }).notNull(),
  fieldLocation: text("field_location").notNull(),
  fieldNotes: text("field_notes").notNull(),
  recommendation: inspectionRecommendationEnum("recommendation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingEventsTable = pgTable("onboarding_events", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id").notNull().references(() => onboardingApplicationsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  fromStatus: onboardingStatusEnum("from_status"),
  toStatus: onboardingStatusEnum("to_status"),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const farmerQuantityRequestsTable = pgTable("farmer_quantity_requests", {
  id: serial("id").primaryKey(),
  farmerId: integer("farmer_id").notNull().references(() => farmersTable.id, { onDelete: "cascade" }),
  sourceApplicationId: integer("source_application_id").references(() => onboardingApplicationsTable.id, { onDelete: "set null" }),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  previousTonnes: numeric("previous_tonnes", { precision: 9, scale: 2, mode: "number" }).notNull(),
  additionalTonnes: numeric("additional_tonnes", { precision: 9, scale: 2, mode: "number" }).notNull(),
  requestedTotalTonnes: numeric("requested_total_tonnes", { precision: 9, scale: 2, mode: "number" }).notNull(),
  source: quantityChangeSourceEnum("source").notNull(),
  reason: text("reason").notNull(),
  fieldPhotoDataBase64: text("field_photo_data_base64"),
  fieldPhotoMimeType: text("field_photo_mime_type"),
  status: quantityRequestStatusEnum("status").notNull().default("pending"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const machinesTable = pgTable("machines", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sourceApplicationId: integer("source_application_id").references(() => onboardingApplicationsTable.id, { onDelete: "set null" }).unique(),
  machineType: machineTypeEnum("machine_type").notNull(),
  machineCount: integer("machine_count").notNull(),
  district: text("district").notNull(),
  serviceRadiusKm: integer("service_radius_km").notNull(),
  availabilityWindow: text("availability_window").notNull(),
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
  assignedOperator: one(usersTable, {
    fields: [farmersTable.assignedOperatorId],
    references: [usersTable.id],
  }),
  batches: many(batchesTable),
  quantityRequests: many(farmerQuantityRequestsTable),
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
  machines: many(machinesTable),
  assignedOnboardingApplications: many(onboardingApplicationsTable, { relationName: "assignedCoordinator" }),
  reviewedOnboardingApplications: many(onboardingApplicationsTable, { relationName: "reviewedBy" }),
  onboardingInspections: many(onboardingInspectionsTable),
  uploadedOnboardingDocuments: many(onboardingDocumentsTable),
  assignedFarmers: many(farmersTable),
  submittedQuantityRequests: many(farmerQuantityRequestsTable, { relationName: "quantityRequestedBy" }),
  reviewedQuantityRequests: many(farmerQuantityRequestsTable, { relationName: "quantityReviewedBy" }),
}));

export const onboardingApplicationsRelations = relations(onboardingApplicationsTable, ({ one, many }) => ({
  assignedCoordinator: one(usersTable, {
    relationName: "assignedCoordinator",
    fields: [onboardingApplicationsTable.assignedCoordinatorId],
    references: [usersTable.id],
  }),
  reviewedBy: one(usersTable, {
    relationName: "reviewedBy",
    fields: [onboardingApplicationsTable.reviewedByUserId],
    references: [usersTable.id],
  }),
  machines: many(machinesTable),
  documents: many(onboardingDocumentsTable),
  events: many(onboardingEventsTable),
  inspections: many(onboardingInspectionsTable),
}));

export const onboardingDocumentsRelations = relations(onboardingDocumentsTable, ({ one }) => ({
  application: one(onboardingApplicationsTable, { fields: [onboardingDocumentsTable.applicationId], references: [onboardingApplicationsTable.id] }),
  uploadedBy: one(usersTable, { fields: [onboardingDocumentsTable.uploadedByUserId], references: [usersTable.id] }),
}));

export const onboardingInspectionsRelations = relations(onboardingInspectionsTable, ({ one }) => ({
  application: one(onboardingApplicationsTable, { fields: [onboardingInspectionsTable.applicationId], references: [onboardingApplicationsTable.id] }),
  inspector: one(usersTable, { fields: [onboardingInspectionsTable.inspectorUserId], references: [usersTable.id] }),
}));

export const onboardingEventsRelations = relations(onboardingEventsTable, ({ one }) => ({
  application: one(onboardingApplicationsTable, { fields: [onboardingEventsTable.applicationId], references: [onboardingApplicationsTable.id] }),
  actor: one(usersTable, { fields: [onboardingEventsTable.actorUserId], references: [usersTable.id] }),
}));

export const farmerQuantityRequestsRelations = relations(farmerQuantityRequestsTable, ({ one }) => ({
  farmer: one(farmersTable, { fields: [farmerQuantityRequestsTable.farmerId], references: [farmersTable.id] }),
  sourceApplication: one(onboardingApplicationsTable, { fields: [farmerQuantityRequestsTable.sourceApplicationId], references: [onboardingApplicationsTable.id] }),
  requestedBy: one(usersTable, { relationName: "quantityRequestedBy", fields: [farmerQuantityRequestsTable.requestedByUserId], references: [usersTable.id] }),
  reviewedBy: one(usersTable, { relationName: "quantityReviewedBy", fields: [farmerQuantityRequestsTable.reviewedByUserId], references: [usersTable.id] }),
}));

export const machinesRelations = relations(machinesTable, ({ one }) => ({
  owner: one(usersTable, { fields: [machinesTable.ownerUserId], references: [usersTable.id] }),
  sourceApplication: one(onboardingApplicationsTable, {
    fields: [machinesTable.sourceApplicationId],
    references: [onboardingApplicationsTable.id],
  }),
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
export const insertOnboardingApplicationSchema = createInsertSchema(onboardingApplicationsTable).omit({
  id: true,
  reference: true,
  status: true,
  assignedCoordinatorId: true,
  reviewedByUserId: true,
  reviewNotes: true,
  phoneVerifiedAt: true,
  appliedAt: true,
  reviewedAt: true,
});
export const insertMachineSchema = createInsertSchema(machinesTable).omit({ id: true, createdAt: true });
export const insertOnboardingDocumentSchema = createInsertSchema(onboardingDocumentsTable).omit({ id: true, uploadedAt: true });
export const insertOnboardingEventSchema = createInsertSchema(onboardingEventsTable).omit({ id: true, createdAt: true });
export const insertOnboardingInspectionSchema = createInsertSchema(onboardingInspectionsTable).omit({ id: true, createdAt: true });
export const insertFarmerQuantityRequestSchema = createInsertSchema(farmerQuantityRequestsTable).omit({ id: true, createdAt: true });

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
export type OnboardingApplication = typeof onboardingApplicationsTable.$inferSelect;
export type InsertOnboardingApplication = z.infer<typeof insertOnboardingApplicationSchema>;
export type Machine = typeof machinesTable.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type OnboardingDocument = typeof onboardingDocumentsTable.$inferSelect;
export type InsertOnboardingDocument = z.infer<typeof insertOnboardingDocumentSchema>;
export type OnboardingEvent = typeof onboardingEventsTable.$inferSelect;
export type InsertOnboardingEvent = z.infer<typeof insertOnboardingEventSchema>;
export type OnboardingInspection = typeof onboardingInspectionsTable.$inferSelect;
export type InsertOnboardingInspection = z.infer<typeof insertOnboardingInspectionSchema>;
export type FarmerQuantityRequest = typeof farmerQuantityRequestsTable.$inferSelect;
export type InsertFarmerQuantityRequest = z.infer<typeof insertFarmerQuantityRequestSchema>;
