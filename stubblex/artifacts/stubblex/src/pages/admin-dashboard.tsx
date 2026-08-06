import { IndianRupee } from "lucide-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { WorkspaceSection } from "@/components/DashboardBlocks";
import { StaffManagement } from "@/components/StaffManagement";
import { AdminControlCentre } from "@/components/AdminControlCentre";

export function AdminDashboardPage() {
  return <RoleDashboardShell allowedRoles={["admin"]} eyebrow="Organization control" title="Admin command centre" description="Approve people, schedule collections, control payments, monitor machines and resolve exceptions from one protected workspace.">{(user) => <>
    <AdminControlCentre />
    <WorkspaceSection eyebrow="Staff access" title="Approved UnpackOS team"><StaffManagement currentUserId={user.id} /></WorkspaceSection>
    <div className="mt-4 rounded-lg border border-straw bg-straw/25 p-5"><div className="flex gap-3"><IndianRupee className="mt-0.5 h-5 w-5 text-straw-foreground" /><div><p className="text-sm font-medium">Financial controls remain admin-only</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Operators submit weighbridge information; only an admin or coordinator confirms farmer payment and buyer orders.</p></div></div></div>
  </>}</RoleDashboardShell>;
}
