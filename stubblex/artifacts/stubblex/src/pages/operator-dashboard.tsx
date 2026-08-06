import { CheckCircle2, Leaf, Truck } from "lucide-react";
import { getListBatchesQueryKey, useListBatches } from "@workspace/api-client-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { DashboardStats, WorkspaceSection } from "@/components/DashboardBlocks";
import { FarmerQuantityPanel } from "@/components/FarmerQuantityPanel";
import { FarmerCallbackPanel } from "@/components/FarmerCallbackPanel";
import { useRoleSummary } from "@/hooks/use-role-summary";

const number = (input: unknown, digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(input ?? 0));
export function OperatorDashboardPage() {
  const { data } = useRoleSummary();
  const { data: batches = [] } = useListBatches({ query: { queryKey: getListBatchesQueryKey(), retry: false } });
  return <RoleDashboardShell allowedRoles={["operator"]} eyebrow="Field execution" title="Operator dispatch" description="Coordinate assigned farmers, collection progress, weighbridge records, and evidence-backed quantity changes.">{(user) => <>
    <DashboardStats items={[
      { label: "Assigned batches", value: number(data?.assignedBatches), note: "Only your operating area", icon: Truck },
      { label: "Assigned quantity", value: `${number(data?.assignedTonnes, 1)} t`, note: "Verified batch weight", icon: Leaf },
      { label: "Completed collections", value: number(data?.completedCollections), note: `${number(data?.activeCollections)} still active`, icon: CheckCircle2 },
    ]} />
    <WorkspaceSection eyebrow="Collection ledger" title="Your assigned batches"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-border bg-secondary/50 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Weight</th><th className="px-5 py-3">Weighbridge</th><th className="px-5 py-3">Buyer</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-4 font-mono text-xs">#{batch.id}</td><td className="px-5 py-4 font-medium">{number(batch.weightTonnes, 2)} t</td><td className="px-5 py-4 text-muted-foreground">{batch.weighbridgeId}</td><td className="px-5 py-4 text-muted-foreground">{batch.buyerName}</td><td className="px-5 py-4"><span className="rounded-full border border-border bg-secondary px-2 py-1 text-[0.65rem] capitalize">{batch.status}</span></td></tr>)}</tbody></table>{batches.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No collections are currently assigned to you.</p>}</div></WorkspaceSection>
    <WorkspaceSection eyebrow="Farmer support" title="Quantity increase requests"><FarmerQuantityPanel canDecide={false} currentUserId={user.id} /></WorkspaceSection>
    <WorkspaceSection eyebrow="Farmer calls" title="Dashboard callback requests"><FarmerCallbackPanel /></WorkspaceSection>
  </>}</RoleDashboardShell>;
}
