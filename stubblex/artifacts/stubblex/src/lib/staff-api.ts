export type StaffRole = "admin" | "coordinator" | "inspector" | "operator" | "aggregator";

export type StaffMember = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

export type RoleDashboardSummary = Record<string, unknown> & {
  role: StaffRole;
  machines?: Array<{ id: number; machineType: string; machineCount: number; district: string; serviceRadiusKm: number; availabilityWindow: string }>;
};

const previewStaff: StaffMember[] = [
  { id: 1, name: "Paridhi Bagga", email: "paridhi@gmail.com", phone: "9876500001", role: "admin", active: true, createdAt: new Date().toISOString() },
  { id: 2, name: "Mehar Kaur", email: "mehar@gmail.com", phone: "9876500002", role: "coordinator", active: true, createdAt: new Date().toISOString() },
  { id: 3, name: "Navjot Kaur", email: "navjot@gmail.com", phone: "9876500006", role: "inspector", active: true, createdAt: new Date().toISOString() },
  { id: 4, name: "Jagmeet Singh", email: "jagmeet@gmail.com", phone: "9876500003", role: "operator", active: true, createdAt: new Date().toISOString() },
  { id: 5, name: "Gursharan Singh", email: "gursharan@gmail.com", phone: "9876500005", role: "aggregator", active: true, createdAt: new Date().toISOString() },
];

function developmentPreview() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw Object.assign(new Error(body.message ?? "Request failed"), { status: response.status });
  return body as T;
}

export const staffApi = {
  list: () => developmentPreview() ? Promise.resolve(previewStaff) : api<StaffMember[]>("/staff"),
  create: (input: { name: string; email: string; phone: string; role: StaffRole }) => api<StaffMember>("/staff", { method: "POST", body: JSON.stringify(input) }),
  update: (staffId: number, input: { role?: StaffRole; active?: boolean }) => api<StaffMember>(`/staff/${staffId}`, { method: "PATCH", body: JSON.stringify(input) }),
  summary: () => developmentPreview() ? Promise.resolve({ role: "admin", staffCount: 5, pendingApplications: 14, totalTonnes: 2146, farmerPaidInr: 858400, deliveredBatches: 28, requestedOrders: 4, openApplications: 9, completedInspections: 11, recommendedInspections: 8, assignedBatches: 6, assignedTonnes: 126, activeCollections: 2, completedCollections: 4, machineCount: 3, assignedJobs: 9, completedJobs: 7, machines: [{ id: 1, machineType: "baler", machineCount: 3, district: "Sangrur", serviceRadiusKm: 55, availabilityWindow: "15 Oct – 30 Nov" }] } as RoleDashboardSummary) : api<RoleDashboardSummary>("/role-dashboard"),
};
