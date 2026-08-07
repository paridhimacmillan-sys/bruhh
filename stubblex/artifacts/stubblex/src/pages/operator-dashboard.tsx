import { useState } from "react";
import { CheckCircle2, Leaf, Phone, Search, Truck } from "lucide-react";
import { getListBatchesQueryKey, useListBatches } from "@workspace/api-client-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { ActionQueue, DashboardStats, WorkflowSteps, WorkspaceSection } from "@/components/DashboardBlocks";
import { FarmerQuantityPanel } from "@/components/FarmerQuantityPanel";
import { FarmerCallbackPanel } from "@/components/FarmerCallbackPanel";
import { useRoleSummary } from "@/hooks/use-role-summary";
import { Input } from "@/components/ui/input";

const number = (input: unknown, digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(input ?? 0));
export function OperatorDashboardPage() {
  const [batchSearch, setBatchSearch] = useState("");
  const { data } = useRoleSummary();
  const { data: batches = [] } = useListBatches({ query: { queryKey: getListBatchesQueryKey(), retry: false } });
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const visibleBatches = preview && batches.length === 0 ? ([
    { id: 431, status: "registered", weightTonnes: 4.2, weighbridgeId: "WB-SUN-114", buyerName: "Punjab BioEnergy", distanceKm: 18 },
    { id: 432, status: "baled", weightTonnes: 6.8, weighbridgeId: "WB-SUN-118", buyerName: "GreenPellet Industries", distanceKm: 27 },
    { id: 433, status: "paid", weightTonnes: 5.4, weighbridgeId: "WB-DHU-091", buyerName: "Sangrur CBG", distanceKm: 31 },
  ] as typeof batches) : batches;
  const summary = preview ? { assignedBatches: 7, assignedTonnes: 38.6, completedCollections: 3, activeCollections: 4 } : data;
  const filteredBatches = visibleBatches.filter((batch) => `${batch.id} ${batch.weighbridgeId} ${batch.buyerName} ${batch.status}`.toLowerCase().includes(batchSearch.toLowerCase()));
  const actionItems = visibleBatches.filter((batch) => batch.status !== "delivered").slice(0, 6).map((batch) => ({
    id: `batch-${batch.id}`,
    title: batch.status === "registered" ? `Prepare pickup for batch #${batch.id}` : batch.status === "baled" ? `Submit weighbridge record for #${batch.id}` : `Confirm handover for batch #${batch.id}`,
    detail: batch.status === "registered" ? "Call the farmer, confirm field access and check that the assigned machine is ready." : batch.status === "baled" ? `Verify ${batch.weightTonnes} t against slip ${batch.weighbridgeId}.` : `Farmer payment is recorded. Coordinate final movement to ${batch.buyerName}.`,
    meta: `${batch.distanceKm} km route · ${batch.status}`,
    urgency: batch.status === "registered" ? "now" as const : "today" as const,
  }));
  return <RoleDashboardShell allowedRoles={["operator"]} eyebrow="Field execution" title="Operator dispatch" description="Coordinate assigned farmers, collection progress, weighbridge records, and evidence-backed quantity changes.">{(user) => <>
    <DashboardStats items={[
      { label: "Assigned batches", value: number(summary?.assignedBatches), note: "Only your operating area", icon: Truck },
      { label: "Assigned quantity", value: `${number(summary?.assignedTonnes, 1)} t`, note: "Verified batch weight", icon: Leaf },
      { label: "Completed collections", value: number(summary?.completedCollections), note: `${number(summary?.activeCollections)} still active`, icon: CheckCircle2 },
    ]} />
    <ActionQueue items={actionItems} title="Your next field actions" />
    <WorkspaceSection eyebrow="Operating sequence" title="Complete every collection in order"><WorkflowSteps steps={[
      { label: "Confirm farmer", detail: "Call before departure and confirm field access.", state: visibleBatches.some((batch) => batch.status === "registered") ? "current" : "done" },
      { label: "Bale and collect", detail: "Record arrival, machine and collection evidence.", state: visibleBatches.some((batch) => batch.status === "registered") ? "upcoming" : visibleBatches.some((batch) => batch.status === "baled") ? "current" : "done" },
      { label: "Weigh", detail: "Upload the weighbridge slip and final payable tonnes.", state: visibleBatches.some((batch) => batch.status === "baled") ? "current" : "upcoming" },
      { label: "Handover", detail: "Coordinate buyer delivery after payment confirmation.", state: visibleBatches.some((batch) => batch.status === "paid") ? "current" : "upcoming" },
    ]} /></WorkspaceSection>
    <WorkspaceSection eyebrow="Collection ledger" title="Your assigned batches"><div className="border-b border-border p-4"><label className="relative block max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Search batch, buyer or weighbridge" className="pl-9" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-border bg-secondary/50 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3">Batch</th><th className="px-5 py-3">Weight</th><th className="px-5 py-3">Weighbridge</th><th className="px-5 py-3">Buyer</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{filteredBatches.map((batch) => <tr key={batch.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-4 font-mono text-xs">#{batch.id}</td><td className="px-5 py-4 font-medium">{number(batch.weightTonnes, 2)} t</td><td className="px-5 py-4 text-muted-foreground">{batch.weighbridgeId}</td><td className="px-5 py-4 text-muted-foreground">{batch.buyerName}</td><td className="px-5 py-4"><span className="rounded-full border border-border bg-secondary px-2 py-1 text-[0.65rem] capitalize">{batch.status}</span></td></tr>)}</tbody></table>{filteredBatches.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No matching collections found.</p>}</div></WorkspaceSection>
    <WorkspaceSection eyebrow="Farmer support" title="Quantity increase requests"><FarmerQuantityPanel canDecide={false} currentUserId={user.id} /></WorkspaceSection>
    <WorkspaceSection eyebrow="Farmer calls" title="Dashboard callback requests"><FarmerCallbackPanel /><div className="border-t border-border bg-secondary/30 p-4"><a href="tel:+919876500001" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="h-4 w-4" />Call Sangrur coordinator</a><span className="ml-3 text-xs text-muted-foreground">Use for reassignment, breakdowns or safety issues.</span></div></WorkspaceSection>
  </>}</RoleDashboardShell>;
}
