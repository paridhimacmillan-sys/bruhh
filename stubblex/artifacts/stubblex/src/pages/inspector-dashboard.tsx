import { CalendarDays, CheckCircle2, ClipboardCheck, MapPin, Phone } from "lucide-react";
import { getListOnboardingApplicationsQueryKey, useListOnboardingApplications } from "@workspace/api-client-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { ActionQueue, DashboardStats, WorkflowSteps, WorkspaceSection } from "@/components/DashboardBlocks";
import { OnboardingPanel } from "@/components/OnboardingPanel";
import { useRoleSummary } from "@/hooks/use-role-summary";

const value = (input: unknown) => String(Number(input ?? 0));
export function InspectorDashboardPage() {
  const { data } = useRoleSummary();
  const { data: applications = [] } = useListOnboardingApplications({ query: { queryKey: getListOnboardingApplicationsQueryKey(), retry: false } });
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const visibleApplications = preview && applications.length === 0 ? ([
    { id: 41, name: "Gurpreet Singh", phone: "9814001001", district: "Sangrur", applicantType: "farmer", status: "new" },
    { id: 42, name: "Harpreet Kaur", phone: "9814001002", district: "Sangrur", applicantType: "farmer", status: "documents_pending" },
    { id: 43, name: "Malwa Baler Services", phone: "9814001003", district: "Sangrur", applicantType: "machine_partner", status: "contacted" },
  ] as typeof applications) : applications;
  const summary = preview ? { openApplications: 6, completedInspections: 9, recommendedInspections: 4 } : data;
  const actionItems = visibleApplications.filter((application) => !["approved", "rejected", "waitlisted"].includes(application.status)).slice(0, 6).map((application) => ({
    id: `application-${application.id}`,
    title: application.status === "new" ? `Contact ${application.name}` : `Verify ${application.name}'s field`,
    detail: application.status === "documents_pending" ? "Documents are still pending. Collect them during the farm visit if needed." : `${application.district} · field location to confirm`,
    meta: `${application.applicantType.replaceAll("_", " ")} · ${application.status.replaceAll("_", " ")}`,
    urgency: application.status === "new" ? "now" as const : "today" as const,
    href: "#inspection-queue",
    actionLabel: "Open application",
  }));
  return <RoleDashboardShell allowedRoles={["inspector"]} eyebrow="Field verification" title="Inspector field desk" description="Record field observations, upload evidence, and submit recommendations. Final approval remains with UnpackOS administration.">{() => <>
    <DashboardStats items={[
      { label: "Open applications", value: value(summary?.openApplications), note: "Available for field verification", icon: MapPin },
      { label: "Inspections completed", value: value(summary?.completedInspections), note: "Recorded under your account", icon: ClipboardCheck },
      { label: "Recommended", value: value(summary?.recommendedInspections), note: "Awaiting admin decision", icon: CheckCircle2 },
    ]} />
    <ActionQueue items={actionItems} title="Visits and verification due" />
    <WorkspaceSection eyebrow="Visit plan" title="Today's field route"><div className="grid gap-3 p-5 md:grid-cols-3">{visibleApplications.slice(0, 3).map((application, index) => <article key={application.id} className="rounded-lg border border-border bg-secondary/25 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">{["09:30", "11:45", "14:30"][index] ?? "Later"}</span><CalendarDays className="h-4 w-4 text-primary" /></div><h3 className="mt-4 font-display text-xl">{application.name}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{application.district} · {application.applicantType.replaceAll("_", " ")}</p><a href={`tel:+91${application.phone}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="h-4 w-4" />Call before visit</a></article>)}</div></WorkspaceSection>
    <WorkspaceSection eyebrow="Visit checklist" title="One complete, auditable field visit"><WorkflowSteps steps={[
      { label: "Call and locate", detail: "Confirm the farmer, village and visit time.", state: "done" },
      { label: "Inspect field", detail: "Check acreage, crop readiness and access for machinery.", state: "current" },
      { label: "Capture proof", detail: "Add geotagged photos, documents and farmer consent.", state: "upcoming" },
      { label: "Recommend", detail: "Submit findings for admin approval. You cannot self-approve.", state: "upcoming" },
    ]} /></WorkspaceSection>
    <div id="inspection-queue"><WorkspaceSection eyebrow="Inspection queue" title="Farmer and partner verification"><OnboardingPanel canDecide={false} /></WorkspaceSection></div>
  </>}</RoleDashboardShell>;
}
