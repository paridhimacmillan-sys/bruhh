export type AdminSettings = {
  id: number;
  seasonName: string;
  seasonTargetTonnes: number;
  farmerRateInrPerTonne: number;
  saleRateInrPerTonne: number;
  commissionPct: number;
  pickupPenaltyInr: number;
  seasonStart: string | null;
  seasonEnd: string | null;
  updatedAt: string;
};

export type AdminControlData = {
  generatedAt: string;
  settings: AdminSettings;
  staff: Array<{ id: number; name: string; phone: string; email: string | null; role: string; active: boolean }>;
  schedules: Array<{ id: number; passportId: string; farmerName: string; farmerPhone: string; clusterName: string; district: string; weightTonnes: number; pickupScheduledAt: string | null; pickupLockedAt: string | null; pickupNotes: string | null; assignedOperatorId: number | null; assignedAggregatorId: number | null; operatorName: string | null; aggregatorName: string | null; status: string }>;
  payments: Array<{ batchId: number; passportId: string; farmerName: string; farmerPhone: string; weightTonnes: number; amountInr: number; weighbridgeId: string; batchStatus: string; reviewStatus: string; reviewNotes: string | null; reviewedAt: string | null }>;
  machines: Array<{ id: number; ownerUserId: number; ownerName: string; ownerPhone: string; machineType: string; machineCount: number; district: string; serviceRadiusKm: number; availabilityWindow: string; status: string; registrationNumber: string | null; rateInrPerDay: number | null; lastServiceAt: string | null }>;
  applications: Array<{ id: number; reference: string; applicantType: string; name: string; phone: string; district: string; status: string; appliedAt: string }>;
  quantityRequests: Array<{ id: number; farmerName: string; requestedByName: string; previousTonnes: number; additionalTonnes: number; requestedTotalTonnes: number; source: string; reason: string; status: string; createdAt: string }>;
  orders: Array<{ id: number; lotId: string; company: string; phone: string; tonnes: number; status: string; createdAt: string }>;
  alerts: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; detail: string; href?: string }>;
  auditLog: Array<{ id: number; actorName: string; action: string; entityType: string; entityId: string; details: Record<string, unknown>; createdAt: string }>;
  reports: { clusters: Array<{ id: number; name: string; district: string; acres: number; batches: number; tonnes: number; paidInr: number }>; totalTonnes: number; totalFarmerPaidInr: number; deliveredBatches: number; requestedOrders: number; projectedSalesInr: number };
};

const now = new Date().toISOString();
const previewData: AdminControlData = {
  generatedAt: now,
  settings: { id: 1, seasonName: "Sangrur pilot", seasonTargetTonnes: 3400, farmerRateInrPerTonne: 400, saleRateInrPerTonne: 1700, commissionPct: 5, pickupPenaltyInr: 15000, seasonStart: "2025-10-15T00:00:00.000Z", seasonEnd: "2025-11-30T00:00:00.000Z", updatedAt: now },
  staff: [
    { id: 1, name: "Amandeep Singh", phone: "9876500001", email: "admin@unpackos.in", role: "admin", active: true },
    { id: 2, name: "Mehar Kaur", phone: "9876500002", email: "coordinator@unpackos.in", role: "coordinator", active: true },
    { id: 3, name: "Jagmeet Singh", phone: "9876500003", email: "operator@unpackos.in", role: "operator", active: true },
    { id: 5, name: "Gursharan Singh", phone: "9876500005", email: "aggregator@unpackos.in", role: "aggregator", active: true },
  ],
  schedules: [
    { id: 431, passportId: "PB07-0431", farmerName: "Gurpreet Singh", farmerPhone: "9814001001", clusterName: "Sunam North", district: "Sangrur", weightTonnes: 42, pickupScheduledAt: "2025-10-18T08:30:00.000Z", pickupLockedAt: "2025-10-10T08:30:00.000Z", pickupNotes: "Morning collection slot", assignedOperatorId: 3, assignedAggregatorId: 5, operatorName: "Jagmeet Singh", aggregatorName: "Gursharan Singh", status: "registered" },
    { id: 432, passportId: "PB07-0432", farmerName: "Harpreet Kaur", farmerPhone: "9814001002", clusterName: "Dhuri East", district: "Sangrur", weightTonnes: 58, pickupScheduledAt: "2025-10-19T08:30:00.000Z", pickupLockedAt: null, pickupNotes: null, assignedOperatorId: 3, assignedAggregatorId: 5, operatorName: "Jagmeet Singh", aggregatorName: "Gursharan Singh", status: "baled" },
  ],
  payments: [
    { batchId: 431, passportId: "PB07-0431", farmerName: "Gurpreet Singh", farmerPhone: "9814001001", weightTonnes: 42, amountInr: 16800, weighbridgeId: "WB-SUN-114", batchStatus: "baled", reviewStatus: "pending", reviewNotes: null, reviewedAt: null },
    { batchId: 432, passportId: "PB07-0432", farmerName: "Harpreet Kaur", farmerPhone: "9814001002", weightTonnes: 58, amountInr: 23200, weighbridgeId: "WB-DHU-031", batchStatus: "paid", reviewStatus: "reconciled", reviewNotes: "Matched to FPO statement", reviewedAt: now },
  ],
  machines: [
    { id: 1, ownerUserId: 5, ownerName: "Gursharan Singh", ownerPhone: "9876500005", machineType: "baler", machineCount: 3, district: "Sangrur", serviceRadiusKm: 55, availabilityWindow: "15 Oct – 30 Nov", status: "available", registrationNumber: "PB13-DEMO", rateInrPerDay: 18000, lastServiceAt: "2025-10-10T00:00:00.000Z" },
    { id: 2, ownerUserId: 5, ownerName: "Gursharan Singh", ownerPhone: "9876500005", machineType: "truck", machineCount: 5, district: "Sangrur", serviceRadiusKm: 80, availabilityWindow: "October – February", status: "maintenance", registrationNumber: "PB13-TRK", rateInrPerDay: 12000, lastServiceAt: "2025-09-20T00:00:00.000Z" },
  ],
  applications: [
    { id: 1, reference: "UNP-2025-1001", applicantType: "farmer", name: "Sukhwinder Singh", phone: "9814112201", district: "Sangrur", status: "verified", appliedAt: now },
    { id: 2, reference: "UNP-2025-1002", applicantType: "machine_partner", name: "Manjit Agro Services", phone: "9814112202", district: "Sangrur", status: "documents_pending", appliedAt: now },
  ],
  quantityRequests: [{ id: 1, farmerName: "Baljit Singh", requestedByName: "Jagmeet Singh", previousTonnes: 20, additionalTonnes: 12, requestedTotalTonnes: 32, source: "additional_land", reason: "Farmer leased neighbouring plot", status: "pending", createdAt: now }],
  orders: [{ id: 14, lotId: "LOT-SGR-2503", company: "Punjab BioHeat Ltd", phone: "9814005500", tonnes: 500, status: "requested", createdAt: now }],
  alerts: [
    { id: "payments", severity: "high", title: "1 farmer payment awaits review", detail: "Match the weighbridge record before approval." },
    { id: "machines", severity: "medium", title: "1 machine unit is under maintenance", detail: "Reassign affected pickup work." },
    { id: "applications", severity: "medium", title: "2 applications need attention", detail: "Review farmer and partner onboarding requests.", href: "/dispatch" },
  ],
  auditLog: [
    { id: 1, actorName: "Mehar Kaur", action: "farmer_quantity_verified", entityType: "farmer", entityId: "18", details: { additionalTonnes: 12 }, createdAt: now },
    { id: 2, actorName: "Amandeep Singh", action: "staff_role_updated", entityType: "user", entityId: "5", details: { role: "aggregator" }, createdAt: now },
  ],
  reports: { clusters: [{ id: 1, name: "Sunam North", district: "Sangrur", acres: 1460, batches: 14, tonnes: 920, paidInr: 368000 }, { id: 2, name: "Dhuri East", district: "Sangrur", acres: 1180, batches: 11, tonnes: 706, paidInr: 282400 }, { id: 3, name: "Lehragaga South", district: "Sangrur", acres: 1325, batches: 9, tonnes: 520, paidInr: 208000 }], totalTonnes: 2146, totalFarmerPaidInr: 858400, deliveredBatches: 28, requestedOrders: 4, projectedSalesInr: 3648200 },
};

function developmentPreview() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body as T;
}

export const adminControlApi = {
  get: () => developmentPreview() ? Promise.resolve(previewData) : api<AdminControlData>("/admin/control-centre"),
  schedule: (batchId: number, body: Record<string, unknown>) => developmentPreview() ? Promise.resolve(body) : api(`/admin/schedules/${batchId}`, { method: "PATCH", body: JSON.stringify(body) }),
  payment: (batchId: number, status: string, notes?: string) => developmentPreview() ? Promise.resolve({ status }) : api(`/admin/payments/${batchId}/review`, { method: "POST", body: JSON.stringify({ status, notes }) }),
  machine: (machineId: number, body: Record<string, unknown>) => developmentPreview() ? Promise.resolve(body) : api(`/admin/machines/${machineId}`, { method: "PATCH", body: JSON.stringify(body) }),
  settings: (body: Partial<AdminSettings>) => developmentPreview() ? Promise.resolve(body) : api("/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
  sms: (batchId: number, kind: string, send: boolean) => developmentPreview() ? Promise.resolve({ message: `UnpackOS demo ${kind} message for batch ${batchId}`, phone: "9814001001", sent: send }) : api<{ message: string; phone: string; sent: boolean }>(`/admin/sms/${batchId}`, { method: "POST", body: JSON.stringify({ kind, send }) }),
};
