import { useState } from "react";
import { CheckCircle2, Gauge, Search, Tractor } from "lucide-react";
import { getListBatchesQueryKey, useListBatches } from "@workspace/api-client-react";
import { RoleDashboardShell } from "@/components/RoleDashboardShell";
import { ActionQueue, DashboardStats, WorkflowSteps, WorkspaceSection } from "@/components/DashboardBlocks";
import { useRoleSummary } from "@/hooks/use-role-summary";
import { Input } from "@/components/ui/input";

const number = (input: unknown, digits = 0) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(input ?? 0));
export function AggregatorDashboardPage() {
  const [jobSearch, setJobSearch] = useState("");
  const { data } = useRoleSummary();
  const { data: jobs = [] } = useListBatches({ query: { queryKey: getListBatchesQueryKey(), retry: false } });
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const visibleJobs = preview && jobs.length === 0 ? ([
    { id: 431, status: "registered", weightTonnes: 4.2, weighbridgeId: "WB-SUN-114", distanceKm: 18 },
    { id: 432, status: "baled", weightTonnes: 6.8, weighbridgeId: "WB-SUN-118", distanceKm: 27 },
    { id: 433, status: "paid", weightTonnes: 5.4, weighbridgeId: "WB-DHU-091", distanceKm: 31 },
  ] as typeof jobs) : jobs;
  const summary = preview ? { machineCount: 5, assignedJobs: 8, assignedTonnes: 46.4, completedJobs: 3 } : data;
  const filteredJobs = visibleJobs.filter((job) => `${job.id} ${job.weighbridgeId} ${job.status}`.toLowerCase().includes(jobSearch.toLowerCase()));
  const actionItems = visibleJobs.filter((job) => job.status !== "delivered").slice(0, 6).map((job) => ({
    id: `job-${job.id}`,
    title: job.status === "registered" ? `Accept and crew job #${job.id}` : job.status === "baled" ? `Machine work complete for #${job.id}` : `Prepare delivery support for #${job.id}`,
    detail: job.status === "registered" ? "Confirm the assigned machine, driver and operating window with the coordinator." : `${number(job.weightTonnes, 1)} t · ${number(job.distanceKm)} km from the assigned route.`,
    meta: `${job.status} · ${job.weighbridgeId}`,
    urgency: job.status === "registered" ? "now" as const : "today" as const,
  }));
  return <RoleDashboardShell allowedRoles={["aggregator"]} eyebrow="Machine partner" title="Aggregator workspace" description="See only the work allocated to your machinery, your registered capacity, and completion status.">{() => <>
    <DashboardStats items={[
      { label: "Registered machines", value: number(summary?.machineCount), note: "Across your approved fleet", icon: Tractor },
      { label: "Assigned jobs", value: number(summary?.assignedJobs), note: `${number(summary?.assignedTonnes, 1)} tonnes allocated`, icon: Gauge },
      { label: "Completed jobs", value: number(summary?.completedJobs), note: "Delivered to buyer", icon: CheckCircle2 },
    ]} />
    <ActionQueue items={actionItems} title="Fleet actions for today" />
    <WorkspaceSection eyebrow="Job lifecycle" title="From allocation to completed machine work"><WorkflowSteps steps={[
      { label: "Accept allocation", detail: "Confirm machine, crew and available operating window.", state: visibleJobs.some((job) => job.status === "registered") ? "current" : "done" },
      { label: "Dispatch machine", detail: "Send equipment only after operator confirms field access.", state: visibleJobs.some((job) => job.status === "registered") ? "upcoming" : "current" },
      { label: "Complete work", detail: "Operator records the weighbridge result and evidence.", state: visibleJobs.some((job) => job.status === "baled") ? "current" : "upcoming" },
      { label: "Close job", detail: "Report downtime, fuel and service needs before release.", state: visibleJobs.some((job) => job.status === "paid") ? "current" : "upcoming" },
    ]} /></WorkspaceSection>
    <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.4fr]">
      <section className="rounded-lg border border-border bg-card p-5"><p className="eyebrow">Approved capacity</p><h2 className="mt-2 font-display text-2xl">Your machinery</h2><div className="mt-5 space-y-3">{data?.machines?.map((machine) => <div key={machine.id} className="rounded-md border border-border bg-secondary/30 p-4"><div className="flex justify-between gap-3"><p className="font-medium capitalize">{machine.machineType} × {machine.machineCount}</p><span className="rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] text-primary">Approved</span></div><p className="mt-2 text-xs text-muted-foreground">{machine.district} · {machine.serviceRadiusKm} km radius</p><p className="mt-1 text-xs text-muted-foreground">{machine.availabilityWindow}</p></div>)}{(!data?.machines || data.machines.length === 0) && <p className="text-sm text-muted-foreground">No machinery has been linked to this account yet.</p>}</div></section>
      <WorkspaceSection eyebrow="Allocated work" title="Collection jobs"><div className="border-b border-border p-4"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Search job or weighbridge" className="pl-9" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-border bg-secondary/50 text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-4 py-3">Job</th><th className="px-4 py-3">Tonnes</th><th className="px-4 py-3">Distance</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{filteredJobs.map((job) => <tr key={job.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-4 font-mono text-xs">Batch #{job.id}</td><td className="px-4 py-4 font-medium">{number(job.weightTonnes, 2)} t</td><td className="px-4 py-4 text-muted-foreground">{job.distanceKm} km</td><td className="px-4 py-4"><span className="rounded-full border border-border bg-secondary px-2 py-1 text-[0.65rem] capitalize">{job.status}</span></td></tr>)}</tbody></table>{filteredJobs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No matching jobs found.</p>}</div></WorkspaceSection>
    </div>
  </>}</RoleDashboardShell>;
}
