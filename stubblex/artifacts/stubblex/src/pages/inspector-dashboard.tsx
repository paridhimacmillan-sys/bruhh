import { CheckCircle2, ClipboardCheck, MapPin } from "lucide-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { DashboardStats, WorkspaceSection } from "@/components/DashboardBlocks";
import { OnboardingPanel } from "@/components/OnboardingPanel";
import { useRoleSummary } from "@/hooks/use-role-summary";

const value = (input: unknown) => String(Number(input ?? 0));
export function InspectorDashboardPage() {
  const { data } = useRoleSummary();
  return <RoleDashboardShell allowedRoles={["inspector"]} eyebrow="Field verification" title="Inspector field desk" description="Record field observations, upload evidence, and submit recommendations. Final approval remains with UnpackOS administration.">{() => <>
    <DashboardStats items={[
      { label: "Open applications", value: value(data?.openApplications), note: "Available for field verification", icon: MapPin },
      { label: "Inspections completed", value: value(data?.completedInspections), note: "Recorded under your account", icon: ClipboardCheck },
      { label: "Recommended", value: value(data?.recommendedInspections), note: "Awaiting admin decision", icon: CheckCircle2 },
    ]} />
    <WorkspaceSection eyebrow="Inspection queue" title="Farmer and partner verification"><OnboardingPanel canDecide={false} /></WorkspaceSection>
  </>}</RoleDashboardShell>;
}
