import { CheckCircle2, Gauge, Tractor } from "lucide-react";
import { getListBatchesQueryKey, useListBatches } from "@workspace/api-client-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { DashboardStats, WorkspaceSection } from "@/components/DashboardBlocks";
import { useRoleSummary } from "@/hooks/use-role-summary";

const number = (input: unknown, digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(input ?? 0));
export function AggregatorDashboardPage() {
  const { data } = useRoleSummary();
  const { data: jobs = [] } = useListBatches({ query: { queryKey: getListBatchesQueryKey(), retry: false } });
  return <RoleDashboardShell allowedRoles={["aggregator"]} eyebrow="Machine partner" title="Aggregator workspace" description="See only the work allocated to your machinery, your registered capacity, and completion status.">{() => <>
    <DashboardStats items={[
      { label: "Registered machines", value: number(data?.machineCount), note: "Across your approved fleet", icon: Tractor },
      { label: "Assigned jobs", value: number(data?.assignedJobs), note: `${number(data?.assignedTonnes, 1)} tonnes allocated`, icon: Gauge },
      { label: "Completed jobs", value: number(data?.completedJobs), note: "Delivered to buyer", icon: CheckCircle2 },
    ]} />
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.4fr]">
      <section className="rounded-lg border border-border bg-card p-5"><p className="eyebrow">Approved capacity</p><h2 className="mt-2 font-display text-2xl">Your machinery</h2><div className="mt-5 space-y-3">{data?.machines?.map((machine) => <div key={machine.id} className="rounded-md border border-border bg-secondary/30 p-4"><div className="flex justify-between gap-3"><p className="font-medium capitalize">{machine.machineType} × {machine.machineCount}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] text-primary">Approved</span></div><p className="mt-2 text-xs text-muted-foreground">{machine.district} · {machine.serviceRadiusKm} km radius</p><p className="mt-1 text-xs text-muted-foreground">{machine.availabilityWindow}</p></div>)}{(!data?.machines || data.machines.length === 0) && <p className="text-sm text-muted-foreground">No machinery has been linked to this account yet.</p>}</div></section>
      <WorkspaceSection eyebrow="Allocated work" title="Collection jobs"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-border bg-secondary/50 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-4 py-3">Job</th><th className="px-4 py-3">Tonnes</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-4 font-mono text-xs">Batch #{job.id}</td><td className="px-4 py-4 font-medium">{number(job.weightTonnes, 2)} t</td><td className="px-4 py-4 text-muted-foreground">{job.distanceKm} km</td><td className="px-4 py-4"><span className="rounded-full border border-border bg-secondary px-2 py-1 text-[0.65rem] capitalize">{job.status}</span></td></tr>)}</tbody></table>{jobs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No jobs have been allocated to your account.</p>}</div></WorkspaceSection>
    </div>
  </>}</RoleDashboardShell>;
}
