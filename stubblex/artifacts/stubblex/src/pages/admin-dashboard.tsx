import { ClipboardCheck, IndianRupee, Leaf, Users } from "lucide-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { DashboardStats, WorkspaceSection } from "@/components/DashboardBlocks";
import { StaffManagement } from "@/components/StaffManagement";
import { useRoleSummary } from "@/hooks/use-role-summary";

const number = (value: unknown) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(Number(value ?? 0));
const inr = (value: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value ?? 0));

export function AdminDashboardPage() {
  const { data } = useRoleSummary();
  return <RoleDashboardShell allowedRoles={["admin"]} eyebrow="Organization control" title="Admin command centre" description="Approve your team, monitor the Sangrur pilot, and keep sensitive decisions separate from field execution.">{(user) => <>
    <DashboardStats items={[
      { label: "Active staff", value: number(data?.staffCount), note: "Approved Google accounts", icon: Users },
      { label: "Awaiting review", value: number(data?.pendingApplications), note: "Farmer and partner applications", icon: ClipboardCheck },
      { label: "Tonnes coordinated", value: `${number(data?.totalTonnes)} t`, note: `${inr(data?.farmerPaidInr)} paid to farmers`, icon: Leaf },
    ]} />
    <WorkspaceSection eyebrow="Staff management" title="Who can access UnpackOS"><StaffManagement currentUserId={user.id} /></WorkspaceSection>
    <div className="mt-4 rounded-lg border border-straw bg-straw/25 p-5"><div className="flex gap-3"><IndianRupee className="mt-0.5 h-5 w-5 text-straw-foreground" /><div><p className="text-sm font-medium">Financial controls remain admin-only</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Operators submit weighbridge information; only an admin or coordinator confirms farmer payment and buyer orders.</p></div></div></div>
  </>}</RoleDashboardShell>;
}
