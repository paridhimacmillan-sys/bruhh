import { randomBytes, randomInt } from "node:crypto";
import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  ApproveOnboardingApplicationBody,
  ApproveOnboardingApplicationParams,
  ApproveOnboardingApplicationResponse,
  ApproveFarmerQuantityRequestBody,
  ApproveFarmerQuantityRequestParams,
  ApproveFarmerQuantityRequestResponse,
  CreateFarmerQuantityRequestBody,
  CreateFarmerQuantityRequestResponse,
  GetFarmerQuantityRequestPhotoParams,
  GetFarmerQuantityRequestPhotoResponse,
  CreateOnboardingApplicationBody,
  CreateOnboardingApplicationResponse,
  CreateOnboardingApplicationInspectionBody,
  CreateOnboardingApplicationInspectionParams,
  CreateOnboardingApplicationInspectionResponse,
  ListOnboardingApplicationsResponse,
  ListOnboardingApplicationInspectionsResponse,
  ListFarmerQuantityRequestsResponse,
  ListFarmerSuppliersResponse,
  ListFieldOperatorsResponse,
  OnboardingRequestOtpBody,
  OnboardingVerifyOtpBody,
  RejectOnboardingApplicationBody,
  RejectOnboardingApplicationParams,
  RejectOnboardingApplicationResponse,
  RejectFarmerQuantityRequestBody,
  RejectFarmerQuantityRequestParams,
  RejectFarmerQuantityRequestResponse,
  UpdateOnboardingApplicationStatusBody,
  UpdateOnboardingApplicationStatusParams,
  UpdateOnboardingApplicationStatusResponse,
  UploadOnboardingApplicationDocumentBody,
  UploadOnboardingApplicationDocumentParams,
  UploadOnboardingApplicationDocumentResponse,
} from "@workspace/api-zod";
import {
  clustersTable,
  db,
  farmersTable,
  farmerQuantityRequestsTable,
  machinesTable,
  onboardingApplicationsTable,
  onboardingDocumentsTable,
  onboardingEventsTable,
  onboardingInspectionsTable,
  otpCodesTable,
  usersTable,
  type OnboardingApplication,
  type User,
} from "@workspace/db";
import { requireAuth } from "../lib/session";
import { hashOtp, otpMatches } from "../lib/session";
import { createOnboardingVerificationToken, readOnboardingVerificationToken } from "../lib/onboarding-verification";
import { sendFarmerEnrollmentSms, sendFarmerQuantityUpdatedSms, sendOnboardingDecisionSms, sendOtpSms } from "../lib/sms";

const router: IRouter = Router();

type ApplicationData = Record<string, string | number | null>;
const OTP_TTL_MS = 5 * 60_000;
const OTP_RATE_WINDOW_MS = 15 * 60_000;
const ONBOARDING_OTP_PREFIX = "onboarding:";

function newReference(): string {
  return `STX-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function statusMessage(status: OnboardingApplication["status"]): string {
  return ({
    new: "Application received. The Unpackos team will review it.",
    contacted: "A coordinator has contacted or attempted to contact you.",
    documents_pending: "Additional documents are required. Please contact the Unpackos team.",
    verified: "Your details have been verified and the final decision is pending.",
    approved: "Your application is approved.",
    rejected: "Your application could not be approved. Contact Unpackos for details.",
    waitlisted: "Your application is verified but currently waitlisted.",
  })[status];
}

function normalizeIndianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9][0-9]{9}$/.test(phone) ? phone : null;
}

function stringValue(data: ApplicationData, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(data: ApplicationData, key: string): number | null {
  const value = data[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validateRoleDetails(applicantType: OnboardingApplication["applicantType"], data: ApplicationData): string | null {
  if (applicantType === "farmer") {
    if (!stringValue(data, "village")) return "Village is required for farmer applications";
    if (!positiveNumber(data, "expectedTonnes")) return "Approximate available tonnes must be greater than zero";
  }
  if (applicantType === "machine_partner" || applicantType === "logistics_operator") {
    const machineTypes = ["baler", "rake", "tractor", "loader", "truck", "other"];
    if (!machineTypes.includes(stringValue(data, "machineType"))) return "Choose a valid machine type";
    if (!positiveNumber(data, "machineCount")) return "Machine count must be greater than zero";
    if (!positiveNumber(data, "serviceRadiusKm")) return "Service radius must be greater than zero";
    if (!stringValue(data, "availabilityWindow")) return "Availability window is required";
  }
  if (applicantType === "buyer") {
    if (!stringValue(data, "organizationName")) return "Company name is required for buyers";
    if (!positiveNumber(data, "expectedTonnes")) return "Required volume must be greater than zero";
  }
  return null;
}

function requireOnboardingAccess(res: Response): User | null {
  const user = res.locals.user as User;
  if (user.role !== "admin" && user.role !== "coordinator" && user.role !== "inspector") {
    res.status(403).json({ message: "Onboarding access is limited to Unpackos reviewers and inspectors" });
    return null;
  }
  return user;
}

function requireDecisionMaker(res: Response): User | null {
  const user = res.locals.user as User;
  if (user.role !== "admin" && user.role !== "coordinator") {
    res.status(403).json({ message: "Only Unpackos admins and coordinators can approve or reject applications" });
    return null;
  }
  return user;
}

function requireQuantityAccess(res: Response): User | null {
  const user = res.locals.user as User;
  if (user.role !== "admin" && user.role !== "coordinator" && user.role !== "operator") {
    res.status(403).json({ message: "Farmer quantity updates are limited to operators, coordinators and admins" });
    return null;
  }
  return user;
}

async function loadQuantityRequestView(requestId: number) {
  const [row] = await db.select({
    request: farmerQuantityRequestsTable,
    farmerName: farmersTable.name,
    farmerPhone: farmersTable.phone,
    requestedByName: usersTable.name,
  }).from(farmerQuantityRequestsTable)
    .innerJoin(farmersTable, eq(farmerQuantityRequestsTable.farmerId, farmersTable.id))
    .innerJoin(usersTable, eq(farmerQuantityRequestsTable.requestedByUserId, usersTable.id))
    .where(eq(farmerQuantityRequestsTable.id, requestId)).limit(1);
  if (!row) return null;
  const [reviewer] = row.request.reviewedByUserId
    ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, row.request.reviewedByUserId)).limit(1)
    : [];
  return {
    id: row.request.id,
    farmerId: row.request.farmerId,
    farmerName: row.farmerName,
    farmerPhone: row.farmerPhone,
    requestedByUserId: row.request.requestedByUserId,
    requestedByName: row.requestedByName,
    previousTonnes: row.request.previousTonnes,
    additionalTonnes: row.request.additionalTonnes,
    requestedTotalTonnes: row.request.requestedTotalTonnes,
    source: row.request.source,
    reason: row.request.reason,
    hasFieldPhoto: Boolean(row.request.fieldPhotoDataBase64),
    status: row.request.status,
    reviewedByUserId: row.request.reviewedByUserId,
    reviewedByName: reviewer?.name ?? null,
    reviewNotes: row.request.reviewNotes,
    createdAt: row.request.createdAt,
    reviewedAt: row.request.reviewedAt,
  };
}

router.post("/onboarding/request-otp", async (req, res, next) => {
  const parsed = OnboardingRequestOtpBody.safeParse(req.body);
  const phone = parsed.success ? normalizeIndianPhone(parsed.data.phone) : null;
  if (!phone) return void res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
  const otpPhone = `${ONBOARDING_OTP_PREFIX}${phone}`;
  try {
    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const [rate] = await db.select({ requests: sql<number>`count(*)::int` }).from(otpCodesTable)
      .where(and(eq(otpCodesTable.phone, otpPhone), gte(otpCodesTable.createdAt, windowStart)));
    if ((rate?.requests ?? 0) >= 3) return void res.status(429).json({ message: "Too many OTP requests. Try again in 15 minutes." });
    await db.update(otpCodesTable).set({ consumed: true }).where(and(eq(otpCodesTable.phone, otpPhone), eq(otpCodesTable.consumed, false)));
    const code = String(randomInt(100_000, 1_000_000));
    await db.insert(otpCodesTable).values({ phone: otpPhone, code: hashOtp(otpPhone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
    await sendOtpSms(phone, code);
    res.status(202).json({ message: "Verification OTP sent" });
  } catch (error) { next(error); }
});

router.post("/onboarding/verify-otp", async (req, res, next) => {
  const parsed = OnboardingVerifyOtpBody.safeParse(req.body);
  const phone = parsed.success ? normalizeIndianPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return void res.status(400).json({ message: "Enter a valid phone and 6-digit OTP" });
  const otpPhone = `${ONBOARDING_OTP_PREFIX}${phone}`;
  try {
    const [otp] = await db.select().from(otpCodesTable)
      .where(and(eq(otpCodesTable.phone, otpPhone), eq(otpCodesTable.consumed, false)))
      .orderBy(desc(otpCodesTable.createdAt)).limit(1);
    if (!otp || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= 5 || !otpMatches(otpPhone, parsed.data.code, otp.code)) {
      if (otp) {
        const attempts = otp.attempts + 1;
        await db.update(otpCodesTable).set({ attempts, consumed: attempts >= 5 || otp.expiresAt.getTime() <= Date.now() }).where(eq(otpCodesTable.id, otp.id));
      }
      return void res.status(400).json({ message: "OTP is invalid or expired" });
    }
    await db.update(otpCodesTable).set({ consumed: true }).where(eq(otpCodesTable.id, otp.id));
    res.json({ verificationToken: createOnboardingVerificationToken(phone), message: "Phone verified" });
  } catch (error) { next(error); }
});

router.get("/onboarding/status", async (req, res, next) => {
  const reference = typeof req.query.reference === "string" ? req.query.reference.trim().toUpperCase() : "";
  const phone = typeof req.query.phone === "string" ? normalizeIndianPhone(req.query.phone) : null;
  if (!reference || !phone) return void res.status(400).json({ message: "Reference and verified phone are required" });
  try {
    const [application] = await db.select().from(onboardingApplicationsTable)
      .where(and(eq(onboardingApplicationsTable.reference, reference), eq(onboardingApplicationsTable.phone, phone))).limit(1);
    if (!application) return void res.status(404).json({ message: "Application not found" });
    res.json({ reference, name: application.name, applicantType: application.applicantType, status: application.status, appliedAt: application.appliedAt, statusMessage: statusMessage(application.status) });
  } catch (error) { next(error); }
});

router.post("/onboarding-applications", async (req, res, next) => {
  const parsed = CreateOnboardingApplicationBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ message: "Please check the application details" });

  const phone = normalizeIndianPhone(parsed.data.phone);
  if (!phone) return void res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
  const detailsError = validateRoleDetails(parsed.data.applicantType, parsed.data.applicationData);
  if (detailsError) return void res.status(400).json({ message: detailsError });
  const verification = typeof parsed.data.verificationToken === "string" ? readOnboardingVerificationToken(parsed.data.verificationToken) : null;
  if (!verification || verification.phone !== phone) return void res.status(400).json({ message: "Verify this mobile number with OTP before submitting" });
  const documents = parsed.data.documents ?? [];

  try {
    const [duplicate] = await db
      .select()
      .from(onboardingApplicationsTable)
      .where(and(
        eq(onboardingApplicationsTable.phone, phone),
        eq(onboardingApplicationsTable.applicantType, parsed.data.applicantType),
      ))
      .orderBy(desc(onboardingApplicationsTable.appliedAt))
      .limit(1);
    if (duplicate && duplicate.status !== "rejected") {
      return void res.status(409).json({ message: "An active application already exists for this phone number" });
    }

    const application = await db.transaction(async (tx) => {
      const [created] = await tx.insert(onboardingApplicationsTable).values({
        reference: newReference(), applicantType: parsed.data.applicantType, name: parsed.data.name,
        phone, district: parsed.data.district, applicationData: parsed.data.applicationData, phoneVerifiedAt: new Date(),
      }).returning();
      if (!created) throw new Error("Application insert returned no record");
      if (documents.length) await tx.insert(onboardingDocumentsTable).values(documents.map((document) => ({ ...document, applicationId: created.id })));
      await tx.insert(onboardingEventsTable).values({ applicationId: created.id, action: "application_submitted", toStatus: "new", note: `Phone verified; ${documents.length} document(s) submitted.` });
      return created;
    });
    if (!application) throw new Error("Application insert returned no record");
    res.status(201).json(CreateOnboardingApplicationResponse.parse(application));
  } catch (error) {
    next(error);
  }
});

router.get("/onboarding-applications", requireAuth, async (_req, res, next) => {
  if (!requireOnboardingAccess(res)) return;
  try {
    const applications = await db.select().from(onboardingApplicationsTable).orderBy(desc(onboardingApplicationsTable.appliedAt));
    res.json(ListOnboardingApplicationsResponse.parse(applications));
  } catch (error) {
    next(error);
  }
});

router.get("/onboarding-clusters", requireAuth, async (_req, res, next) => {
  if (!requireOnboardingAccess(res)) return;
  try {
    const clusters = await db.select().from(clustersTable).orderBy(clustersTable.name);
    res.json(clusters);
  } catch (error) {
    next(error);
  }
});

router.get("/onboarding-applications/:applicationId/history", requireAuth, async (req, res, next) => {
  const user = requireOnboardingAccess(res);
  const applicationId = Number(req.params.applicationId);
  if (!user) return;
  if (!Number.isInteger(applicationId) || applicationId < 1) return void res.status(400).json({ message: "Invalid application" });
  try {
    const history = await db.select({
      id: onboardingEventsTable.id, applicationId: onboardingEventsTable.applicationId, action: onboardingEventsTable.action,
      fromStatus: onboardingEventsTable.fromStatus, toStatus: onboardingEventsTable.toStatus, actorUserId: onboardingEventsTable.actorUserId,
      actorName: usersTable.name, note: onboardingEventsTable.note, createdAt: onboardingEventsTable.createdAt,
    }).from(onboardingEventsTable).leftJoin(usersTable, eq(onboardingEventsTable.actorUserId, usersTable.id))
      .where(eq(onboardingEventsTable.applicationId, applicationId)).orderBy(desc(onboardingEventsTable.createdAt));
    res.json(history);
  } catch (error) { next(error); }
});

router.get("/onboarding-applications/:applicationId/documents", requireAuth, async (req, res, next) => {
  const user = requireOnboardingAccess(res);
  const applicationId = Number(req.params.applicationId);
  if (!user) return;
  if (!Number.isInteger(applicationId) || applicationId < 1) return void res.status(400).json({ message: "Invalid application" });
  try {
    const documents = await db.select().from(onboardingDocumentsTable)
      .where(eq(onboardingDocumentsTable.applicationId, applicationId)).orderBy(onboardingDocumentsTable.uploadedAt);
    res.json(documents);
  } catch (error) { next(error); }
});

router.post("/onboarding-applications/:applicationId/documents", requireAuth, async (req, res, next) => {
  const params = UploadOnboardingApplicationDocumentParams.safeParse(req.params);
  const body = UploadOnboardingApplicationDocumentBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Upload a PDF, JPG, or PNG document up to 2 MB" });
  const user = requireOnboardingAccess(res);
  if (!user) return;
  try {
    const [application] = await db.select({ id: onboardingApplicationsTable.id }).from(onboardingApplicationsTable)
      .where(eq(onboardingApplicationsTable.id, params.data.applicationId)).limit(1);
    if (!application) return void res.status(404).json({ message: "Application not found" });
    const [document] = await db.insert(onboardingDocumentsTable).values({
      ...body.data,
      applicationId: application.id,
      source: "inspector",
      uploadedByUserId: user.id,
    }).returning();
    if (!document) throw new Error("Document upload returned no record");
    await db.insert(onboardingEventsTable).values({ applicationId: application.id, action: "inspector_document_uploaded", actorUserId: user.id, note: `${document.documentType}: ${document.fileName}` });
    res.status(201).json(UploadOnboardingApplicationDocumentResponse.parse(document));
  } catch (error) { next(error); }
});

router.get("/onboarding-applications/:applicationId/inspections", requireAuth, async (req, res, next) => {
  const applicationId = Number(req.params.applicationId);
  const user = requireOnboardingAccess(res);
  if (!user) return;
  if (!Number.isInteger(applicationId) || applicationId < 1) return void res.status(400).json({ message: "Invalid application" });
  try {
    const inspections = await db.select({
      id: onboardingInspectionsTable.id, applicationId: onboardingInspectionsTable.applicationId,
      inspectorUserId: onboardingInspectionsTable.inspectorUserId, inspectorName: usersTable.name,
      visitedAt: onboardingInspectionsTable.visitedAt, observedAcres: onboardingInspectionsTable.observedAcres,
      estimatedTonnes: onboardingInspectionsTable.estimatedTonnes, fieldLocation: onboardingInspectionsTable.fieldLocation,
      fieldNotes: onboardingInspectionsTable.fieldNotes, recommendation: onboardingInspectionsTable.recommendation,
      createdAt: onboardingInspectionsTable.createdAt,
    }).from(onboardingInspectionsTable).innerJoin(usersTable, eq(onboardingInspectionsTable.inspectorUserId, usersTable.id))
      .where(eq(onboardingInspectionsTable.applicationId, applicationId)).orderBy(desc(onboardingInspectionsTable.visitedAt));
    res.json(ListOnboardingApplicationInspectionsResponse.parse(inspections));
  } catch (error) { next(error); }
});

router.post("/onboarding-applications/:applicationId/inspections", requireAuth, async (req, res, next) => {
  const params = CreateOnboardingApplicationInspectionParams.safeParse(req.params);
  const body = CreateOnboardingApplicationInspectionBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Complete all field inspection details" });
  const user = requireOnboardingAccess(res);
  if (!user) return;
  try {
    const [application] = await db.select({ id: onboardingApplicationsTable.id }).from(onboardingApplicationsTable)
      .where(eq(onboardingApplicationsTable.id, params.data.applicationId)).limit(1);
    if (!application) return void res.status(404).json({ message: "Application not found" });
    const [inspection] = await db.insert(onboardingInspectionsTable).values({
      applicationId: application.id,
      inspectorUserId: user.id,
      ...body.data,
    }).returning();
    if (!inspection) throw new Error("Inspection insert returned no record");
    await db.insert(onboardingEventsTable).values({ applicationId: application.id, action: "field_inspection_recorded", actorUserId: user.id, note: `${inspection.recommendation.replaceAll("_", " ")} · ${inspection.observedAcres} acres · ${inspection.estimatedTonnes} t estimated` });
    res.status(201).json(CreateOnboardingApplicationInspectionResponse.parse({ ...inspection, inspectorName: user.name }));
  } catch (error) { next(error); }
});

router.patch("/onboarding-applications/:applicationId/status", requireAuth, async (req, res, next) => {
  const params = UpdateOnboardingApplicationStatusParams.safeParse(req.params);
  const body = UpdateOnboardingApplicationStatusBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Invalid review update" });
  const user = requireOnboardingAccess(res);
  if (!user) return;
  if (user.role === "inspector" && body.success && body.data.status === "waitlisted") {
    return void res.status(403).json({ message: "Inspectors can record verification progress but cannot make allocation decisions" });
  }

  try {
    const [before] = await db.select().from(onboardingApplicationsTable).where(eq(onboardingApplicationsTable.id, params.data.applicationId)).limit(1);
    if (!before) return void res.status(404).json({ message: "Application not found" });
    const [application] = await db.update(onboardingApplicationsTable).set({
      status: body.data.status,
      reviewNotes: body.data.reviewNotes ?? null,
      assignedCoordinatorId: user.id,
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    }).where(eq(onboardingApplicationsTable.id, params.data.applicationId)).returning();
    if (!application) return void res.status(404).json({ message: "Application not found" });
    await db.insert(onboardingEventsTable).values({ applicationId: application.id, action: "status_changed", fromStatus: before.status, toStatus: application.status, actorUserId: user.id, note: body.data.reviewNotes ?? null });
    if (application.status === "documents_pending" || application.status === "waitlisted") {
      await sendOnboardingDecisionSms({ phone: application.phone, name: application.name, reference: application.reference, status: application.status });
    }
    res.json(UpdateOnboardingApplicationStatusResponse.parse(application));
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding-applications/:applicationId/approve", requireAuth, async (req, res, next) => {
  const params = ApproveOnboardingApplicationParams.safeParse(req.params);
  const body = ApproveOnboardingApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Invalid approval request" });
  const reviewer = requireDecisionMaker(res);
  if (!reviewer) return;

  try {
    const result = await db.transaction(async (tx) => {
      const [application] = await tx.select().from(onboardingApplicationsTable)
        .where(eq(onboardingApplicationsTable.id, params.data.applicationId)).limit(1);
      if (!application) return { status: 404 as const, message: "Application not found" };
      if (application.status === "approved") return { status: 200 as const, application };
      if (application.status === "rejected") return { status: 409 as const, message: "Rejected applications must be resubmitted before approval" };

      const data = application.applicationData;
      if (application.applicantType === "farmer") {
        const clusterId = body.data.assignedClusterId;
        const operatorId = body.data.assignedOperatorId;
        if (!clusterId) return { status: 409 as const, message: "Choose a cluster before approving this farmer" };
        if (!operatorId) return { status: 409 as const, message: "Choose a field operator before approving this farmer" };
        const [cluster] = await tx.select({ id: clustersTable.id }).from(clustersTable).where(eq(clustersTable.id, clusterId)).limit(1);
        if (!cluster) return { status: 409 as const, message: "Selected cluster does not exist" };
        const [operator] = await tx.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, operatorId), eq(usersTable.role, "operator"))).limit(1);
        if (!operator) return { status: 409 as const, message: "Selected field operator does not exist" };
        const listedTonnes = positiveNumber(data, "expectedTonnes") ?? 0;
        const [existingFarmer] = await tx.select().from(farmersTable).where(eq(farmersTable.phone, application.phone)).limit(1);
        if (existingFarmer) {
          await tx.update(farmersTable).set({
            name: application.name,
            fpoName: stringValue(data, "organizationName") || "Independent farmer",
            clusterId,
            assignedOperatorId: operatorId,
            listedTonnes,
          }).where(eq(farmersTable.id, existingFarmer.id));
        } else {
          await tx.insert(farmersTable).values({
            name: application.name,
            phone: application.phone,
            fpoName: stringValue(data, "organizationName") || "Independent farmer",
            clusterId,
            assignedOperatorId: operatorId,
            listedTonnes,
          });
        }
      }

      if (application.applicantType === "machine_partner" || application.applicantType === "logistics_operator") {
        const role = application.applicantType === "machine_partner" ? "aggregator" : "operator";
        const email = stringValue(data, "email").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 409 as const, message: "A valid Google account email is required before approving this partner" };
        const [emailOwner] = await tx.select({ id: usersTable.id, phone: usersTable.phone }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
        if (emailOwner && emailOwner.phone !== application.phone) return { status: 409 as const, message: "That Google email is already assigned to another staff account" };
        const [existingUser] = await tx.select().from(usersTable).where(eq(usersTable.phone, application.phone)).limit(1);
        const [partner] = existingUser
          ? await tx.update(usersTable).set({ name: application.name, email, role, active: true }).where(eq(usersTable.id, existingUser.id)).returning()
          : await tx.insert(usersTable).values({ name: application.name, phone: application.phone, email, role }).returning();
        if (!partner) throw new Error("Partner account creation returned no record");

        const machineType = stringValue(data, "machineType") as "baler" | "rake" | "tractor" | "loader" | "truck" | "other";
        const machineCount = Math.round(positiveNumber(data, "machineCount") ?? 1);
        const serviceRadiusKm = Math.round(positiveNumber(data, "serviceRadiusKm") ?? 1);
        const [existingMachine] = await tx.select().from(machinesTable)
          .where(eq(machinesTable.sourceApplicationId, application.id)).limit(1);
        const machine = {
          ownerUserId: partner.id,
          sourceApplicationId: application.id,
          machineType,
          machineCount,
          district: application.district,
          serviceRadiusKm,
          availabilityWindow: stringValue(data, "availabilityWindow"),
        };
        if (existingMachine) await tx.update(machinesTable).set(machine).where(eq(machinesTable.id, existingMachine.id));
        else await tx.insert(machinesTable).values(machine);
      }

      const [approved] = await tx.update(onboardingApplicationsTable).set({
        status: "approved",
        assignedCoordinatorId: reviewer.id,
        reviewedByUserId: reviewer.id,
        reviewNotes: body.data.reviewNotes ?? null,
        reviewedAt: new Date(),
      }).where(eq(onboardingApplicationsTable.id, application.id)).returning();
      if (!approved) throw new Error("Application approval returned no record");
      await tx.insert(onboardingEventsTable).values({ applicationId: application.id, action: "application_approved", fromStatus: application.status, toStatus: "approved", actorUserId: reviewer.id, note: body.data.reviewNotes ?? null });
      return { status: 200 as const, application: approved };
    });

    if (!("application" in result) || !result.application) return void res.status(result.status).json({ message: result.message });
    const approvedApplication = result.application;
    if (approvedApplication.applicantType === "farmer") {
      const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.phone, approvedApplication.phone)).limit(1);
      const [operator] = farmer?.assignedOperatorId
        ? await db.select().from(usersTable).where(eq(usersTable.id, farmer.assignedOperatorId)).limit(1)
        : [];
      if (farmer && operator) {
        await sendFarmerEnrollmentSms({ phone: farmer.phone, name: farmer.name, reference: approvedApplication.reference, operatorName: operator.name, operatorPhone: operator.phone, listedTonnes: farmer.listedTonnes });
      }
    } else if (approvedApplication.applicantType === "machine_partner" || approvedApplication.applicantType === "logistics_operator") {
      console.info(`[onboarding] Partner approved for ${approvedApplication.phone}; Google Sign-In is enabled for the approved email.`);
      await sendOnboardingDecisionSms({ phone: approvedApplication.phone, name: approvedApplication.name, reference: approvedApplication.reference, status: "approved" });
    } else {
      await sendOnboardingDecisionSms({ phone: approvedApplication.phone, name: approvedApplication.name, reference: approvedApplication.reference, status: "approved" });
    }
    res.json(ApproveOnboardingApplicationResponse.parse(approvedApplication));
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding-applications/:applicationId/reject", requireAuth, async (req, res, next) => {
  const params = RejectOnboardingApplicationParams.safeParse(req.params);
  const body = RejectOnboardingApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "A rejection reason is required" });
  const reviewer = requireDecisionMaker(res);
  if (!reviewer) return;

  try {
    const [before] = await db.select().from(onboardingApplicationsTable).where(eq(onboardingApplicationsTable.id, params.data.applicationId)).limit(1);
    if (!before) return void res.status(404).json({ message: "Application not found" });
    const [application] = await db.update(onboardingApplicationsTable).set({
      status: "rejected",
      assignedCoordinatorId: reviewer.id,
      reviewedByUserId: reviewer.id,
      reviewNotes: body.data.reason,
      reviewedAt: new Date(),
    }).where(eq(onboardingApplicationsTable.id, params.data.applicationId)).returning();
    if (!application) return void res.status(404).json({ message: "Application not found" });
    await db.insert(onboardingEventsTable).values({ applicationId: application.id, action: "application_rejected", fromStatus: before.status, toStatus: "rejected", actorUserId: reviewer.id, note: body.data.reason });
    await sendOnboardingDecisionSms({ phone: application.phone, name: application.name, reference: application.reference, status: "rejected" });
    res.json(RejectOnboardingApplicationResponse.parse(application));
  } catch (error) {
    next(error);
  }
});

router.get("/onboarding-operators", requireAuth, async (_req, res, next) => {
  if (!requireOnboardingAccess(res)) return;
  try {
    const operators = await db.select({ id: usersTable.id, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.role, "operator")).orderBy(usersTable.name);
    res.json(ListFieldOperatorsResponse.parse(operators));
  } catch (error) { next(error); }
});

router.get("/farmer-suppliers", requireAuth, async (_req, res, next) => {
  const user = requireQuantityAccess(res);
  if (!user) return;
  try {
    let query = db.select({
      id: farmersTable.id,
      name: farmersTable.name,
      phone: farmersTable.phone,
      fpoName: farmersTable.fpoName,
      clusterId: farmersTable.clusterId,
      clusterName: clustersTable.name,
      district: clustersTable.district,
      assignedOperatorId: farmersTable.assignedOperatorId,
      assignedOperatorName: usersTable.name,
      listedTonnes: farmersTable.listedTonnes,
    }).from(farmersTable)
      .innerJoin(clustersTable, eq(farmersTable.clusterId, clustersTable.id))
      .leftJoin(usersTable, eq(farmersTable.assignedOperatorId, usersTable.id))
      .$dynamic();
    if (user.role === "operator") query = query.where(eq(farmersTable.assignedOperatorId, user.id));
    const farmers = await query.orderBy(farmersTable.name);
    res.json(ListFarmerSuppliersResponse.parse(farmers));
  } catch (error) { next(error); }
});

router.get("/farmer-quantity-requests", requireAuth, async (_req, res, next) => {
  const user = requireQuantityAccess(res);
  if (!user) return;
  try {
    let query = db.select({ id: farmerQuantityRequestsTable.id })
      .from(farmerQuantityRequestsTable)
      .innerJoin(farmersTable, eq(farmerQuantityRequestsTable.farmerId, farmersTable.id))
      .$dynamic();
    if (user.role === "operator") query = query.where(eq(farmersTable.assignedOperatorId, user.id));
    const ids = await query.orderBy(desc(farmerQuantityRequestsTable.createdAt));
    const requests = (await Promise.all(ids.map(({ id }) => loadQuantityRequestView(id)))).filter((item) => item !== null);
    res.json(ListFarmerQuantityRequestsResponse.parse(requests));
  } catch (error) { next(error); }
});

router.post("/farmer-quantity-requests", requireAuth, async (req, res, next) => {
  const user = requireQuantityAccess(res);
  if (!user) return;
  const body = CreateFarmerQuantityRequestBody.safeParse(req.body);
  if (!body.success) return void res.status(400).json({ message: "Enter a farmer, additional tonnes and a clear reason" });
  if (Boolean(body.data.fieldPhotoDataBase64) !== Boolean(body.data.fieldPhotoMimeType)) {
    return void res.status(400).json({ message: "Field photo data and type must be provided together" });
  }
  try {
    const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, body.data.farmerId)).limit(1);
    if (!farmer) return void res.status(404).json({ message: "Farmer not found" });
    if (user.role === "operator" && farmer.assignedOperatorId !== user.id) {
      return void res.status(403).json({ message: "This farmer is assigned to another operator" });
    }
    const [pending] = await db.select({ id: farmerQuantityRequestsTable.id }).from(farmerQuantityRequestsTable)
      .where(and(eq(farmerQuantityRequestsTable.farmerId, farmer.id), eq(farmerQuantityRequestsTable.status, "pending"))).limit(1);
    if (pending) return void res.status(409).json({ message: "This farmer already has a pending quantity request" });
    const [sourceApplication] = await db.select({ id: onboardingApplicationsTable.id }).from(onboardingApplicationsTable)
      .where(and(eq(onboardingApplicationsTable.phone, farmer.phone), eq(onboardingApplicationsTable.applicantType, "farmer"), eq(onboardingApplicationsTable.status, "approved")))
      .orderBy(desc(onboardingApplicationsTable.reviewedAt)).limit(1);
    const [created] = await db.insert(farmerQuantityRequestsTable).values({
      farmerId: farmer.id,
      sourceApplicationId: sourceApplication?.id ?? null,
      requestedByUserId: user.id,
      previousTonnes: farmer.listedTonnes,
      additionalTonnes: body.data.additionalTonnes,
      requestedTotalTonnes: farmer.listedTonnes + body.data.additionalTonnes,
      source: body.data.source,
      reason: body.data.reason.trim(),
      fieldPhotoDataBase64: body.data.fieldPhotoDataBase64 ?? null,
      fieldPhotoMimeType: body.data.fieldPhotoMimeType ?? null,
    }).returning();
    if (!created) throw new Error("Quantity request creation returned no record");
    if (sourceApplication) await db.insert(onboardingEventsTable).values({ applicationId: sourceApplication.id, action: "quantity_increase_requested", actorUserId: user.id, note: `${farmer.listedTonnes} t + ${body.data.additionalTonnes} t = ${created.requestedTotalTonnes} t · ${body.data.source.replaceAll("_", " ")}` });
    const view = await loadQuantityRequestView(created.id);
    res.status(201).json(CreateFarmerQuantityRequestResponse.parse(view));
  } catch (error) { next(error); }
});

router.get("/farmer-quantity-requests/:requestId/photo", requireAuth, async (req, res, next) => {
  const user = requireQuantityAccess(res);
  if (!user) return;
  const params = GetFarmerQuantityRequestPhotoParams.safeParse(req.params);
  if (!params.success) return void res.status(400).json({ message: "Invalid quantity request" });
  try {
    const [record] = await db.select({
      mimeType: farmerQuantityRequestsTable.fieldPhotoMimeType,
      fileDataBase64: farmerQuantityRequestsTable.fieldPhotoDataBase64,
      assignedOperatorId: farmersTable.assignedOperatorId,
    }).from(farmerQuantityRequestsTable)
      .innerJoin(farmersTable, eq(farmerQuantityRequestsTable.farmerId, farmersTable.id))
      .where(eq(farmerQuantityRequestsTable.id, params.data.requestId)).limit(1);
    if (!record || !record.mimeType || !record.fileDataBase64) return void res.status(404).json({ message: "No field photo attached" });
    if (user.role === "operator" && record.assignedOperatorId !== user.id) return void res.status(403).json({ message: "This farmer is assigned to another operator" });
    res.json(GetFarmerQuantityRequestPhotoResponse.parse({ mimeType: record.mimeType, fileDataBase64: record.fileDataBase64 }));
  } catch (error) { next(error); }
});

router.post("/farmer-quantity-requests/:requestId/approve", requireAuth, async (req, res, next) => {
  const params = ApproveFarmerQuantityRequestParams.safeParse(req.params);
  const body = ApproveFarmerQuantityRequestBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "Invalid approval request" });
  const reviewer = requireDecisionMaker(res);
  if (!reviewer) return;
  try {
    const result = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(farmerQuantityRequestsTable).where(eq(farmerQuantityRequestsTable.id, params.data.requestId)).limit(1);
      if (!request) return { status: 404 as const, message: "Quantity request not found" };
      if (request.status !== "pending") return { status: 409 as const, message: "Quantity request has already been decided" };
      if (request.requestedByUserId === reviewer.id) return { status: 409 as const, message: "You cannot approve your own quantity request" };
      const [farmer] = await tx.select().from(farmersTable).where(eq(farmersTable.id, request.farmerId)).limit(1);
      if (!farmer) return { status: 404 as const, message: "Farmer not found" };
      if (Math.abs(farmer.listedTonnes - request.previousTonnes) > 0.001) return { status: 409 as const, message: "Farmer quantity changed after this request; reject it and submit a fresh request" };
      await tx.update(farmersTable).set({ listedTonnes: request.requestedTotalTonnes }).where(eq(farmersTable.id, farmer.id));
      const [approved] = await tx.update(farmerQuantityRequestsTable).set({ status: "approved", reviewedByUserId: reviewer.id, reviewNotes: body.data.reviewNotes ?? null, reviewedAt: new Date() })
        .where(and(eq(farmerQuantityRequestsTable.id, request.id), eq(farmerQuantityRequestsTable.status, "pending"))).returning();
      if (!approved) return { status: 409 as const, message: "Quantity request was changed before approval" };
      if (request.sourceApplicationId) await tx.insert(onboardingEventsTable).values({ applicationId: request.sourceApplicationId, action: "quantity_increase_approved", actorUserId: reviewer.id, note: `${request.previousTonnes} t → ${request.requestedTotalTonnes} t. ${body.data.reviewNotes ?? ""}`.trim() });
      return { status: 200 as const, request: approved, farmer };
    });
    if (!("request" in result) || !result.request || !result.farmer) return void res.status(result.status).json({ message: "message" in result ? result.message : "Quantity request approval failed" });
    await sendFarmerQuantityUpdatedSms({ phone: result.farmer.phone, additionalTonnes: result.request.additionalTonnes, totalTonnes: result.request.requestedTotalTonnes });
    const view = await loadQuantityRequestView(result.request.id);
    res.json(ApproveFarmerQuantityRequestResponse.parse(view));
  } catch (error) { next(error); }
});

router.post("/farmer-quantity-requests/:requestId/reject", requireAuth, async (req, res, next) => {
  const params = RejectFarmerQuantityRequestParams.safeParse(req.params);
  const body = RejectFarmerQuantityRequestBody.safeParse(req.body);
  if (!params.success || !body.success) return void res.status(400).json({ message: "A rejection reason is required" });
  const reviewer = requireDecisionMaker(res);
  if (!reviewer) return;
  try {
    const [request] = await db.select().from(farmerQuantityRequestsTable).where(eq(farmerQuantityRequestsTable.id, params.data.requestId)).limit(1);
    if (!request) return void res.status(404).json({ message: "Quantity request not found" });
    if (request.status !== "pending") return void res.status(409).json({ message: "Quantity request has already been decided" });
    if (request.requestedByUserId === reviewer.id) return void res.status(409).json({ message: "You cannot reject your own quantity request" });
    const [rejected] = await db.update(farmerQuantityRequestsTable).set({ status: "rejected", reviewedByUserId: reviewer.id, reviewNotes: body.data.reason, reviewedAt: new Date() })
      .where(and(eq(farmerQuantityRequestsTable.id, request.id), eq(farmerQuantityRequestsTable.status, "pending"))).returning();
    if (!rejected) return void res.status(409).json({ message: "Quantity request was changed before rejection" });
    if (request.sourceApplicationId) await db.insert(onboardingEventsTable).values({ applicationId: request.sourceApplicationId, action: "quantity_increase_rejected", actorUserId: reviewer.id, note: body.data.reason });
    const view = await loadQuantityRequestView(rejected.id);
    res.json(RejectFarmerQuantityRequestResponse.parse(view));
  } catch (error) { next(error); }
});

export default router;
