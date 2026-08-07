import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  BellRing,
  ClipboardCheck,
  FileClock,
  IndianRupee,
  MailCheck,
  MapPinned,
  MessageSquareText,
  PackageCheck,
  Save,
  ShieldCheck,
  Tractor,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { adminControlApi, type AdminControlData, type AdminSettings } from "@/lib/admin-control-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ActionQueue } from "@/components/DashboardBlocks";

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
const date = (value: string | Date | null) => value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "Not scheduled";

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "neutral" }) {
  const colors = { green: "bg-emerald-50 text-emerald-800 border-emerald-200", amber: "bg-amber-50 text-amber-800 border-amber-200", red: "bg-red-50 text-red-800 border-red-200", neutral: "bg-secondary text-secondary-foreground border-border" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.66rem] font-medium capitalize ${colors[tone]}`}>{children}</span>;
}

function Panel({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-border bg-card"><header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4"><div><h3 className="font-display text-2xl">{title}</h3>{note && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</p>}</div>{action}</header>{children}</section>;
}

function Stat({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof IndianRupee }) {
  return <article className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 font-display text-3xl">{value}</p><p className="mt-1 text-[0.68rem] text-muted-foreground">{note}</p></article>;
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">{children}</table></div>;
}

function Head({ labels }: { labels: string[] }) {
  return <thead className="bg-secondary/55 text-muted-foreground"><tr>{labels.map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function AdminControlCentre() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-control-centre"], queryFn: adminControlApi.get, retry: false });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-control-centre"] });
  const succeed = (title: string) => { toast({ title }); refresh(); };
  const fail = (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" });

  const paymentMutation = useMutation({ mutationFn: ({ batchId, status, notes }: { batchId: number; status: string; notes?: string }) => adminControlApi.payment(batchId, status, notes), onSuccess: (_, input) => succeed(`Payment ${input.status}`), onError: fail });
  const machineMutation = useMutation({ mutationFn: ({ machineId, body }: { machineId: number; body: Record<string, unknown> }) => adminControlApi.machine(machineId, body), onSuccess: () => succeed("Machine record updated"), onError: fail });
  const scheduleMutation = useMutation({ mutationFn: ({ batchId, body }: { batchId: number; body: Record<string, unknown> }) => adminControlApi.schedule(batchId, body), onSuccess: () => succeed("Pickup schedule saved"), onError: fail });
  const settingsMutation = useMutation({ mutationFn: (body: Partial<AdminSettings>) => adminControlApi.settings(body), onSuccess: () => succeed("Organization settings saved"), onError: fail });
  const smsMutation = useMutation({ mutationFn: ({ batchId, kind, send }: { batchId: number; kind: string; send: boolean }) => adminControlApi.sms(batchId, kind, send), onSuccess: (result) => { setSmsPreview(result.message); toast({ title: result.sent ? "Message sent" : "Preview ready", description: `Farmer phone: ${result.phone}` }); }, onError: fail });

  const [settings, setSettings] = useState<Partial<AdminSettings>>({});
  const [scheduleEdits, setScheduleEdits] = useState<Record<number, { pickupScheduledAt?: string; assignedOperatorId?: string; assignedAggregatorId?: string; pickupNotes?: string; overrideReason?: string }>>({});
  const [smsBatchId, setSmsBatchId] = useState(0);
  const [smsKind, setSmsKind] = useState("pickup");
  const [smsPreview, setSmsPreview] = useState("");

  useEffect(() => { if (data?.settings) setSettings(data.settings); }, [data?.settings]);
  useEffect(() => { if (data?.schedules[0] && !smsBatchId) setSmsBatchId(data.schedules[0].id); }, [data?.schedules, smsBatchId]);

  if (isLoading) return <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-secondary" />)}</div>;
  if (error || !data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">The admin control centre could not load. {(error as Error)?.message}</div>;

  const progress = Math.min(100, (data.reports.totalTonnes / Math.max(1, data.settings.seasonTargetTonnes)) * 100);
  const operators = data.staff.filter((item) => item.role === "operator" && item.active);
  const aggregators = data.staff.filter((item) => item.role === "aggregator" && item.active);
  const pendingApplications = data.applications.filter((item) => !["approved", "rejected"].includes(item.status));
  const pendingQuantities = data.quantityRequests.filter((item) => item.status === "pending");
  const pendingPayments = data.payments.filter((item) => item.reviewStatus === "pending");
  const adminActions = [
    ...(pendingApplications.length ? [{ id: "approvals", title: `${pendingApplications.length} applications need a decision`, detail: "Review the inspector recommendation, documents and assignment before approval.", meta: "Onboarding approvals", urgency: "now" as const, href: "#admin-control-tabs", actionLabel: "Open approvals" }] : []),
    ...(pendingPayments.length ? [{ id: "payments", title: `${pendingPayments.length} farmer payments need review`, detail: "Match final tonnes against the weighbridge record before reconciliation.", meta: "Financial control", urgency: "now" as const, href: "#admin-control-tabs", actionLabel: "Open payments" }] : []),
    ...(pendingQuantities.length ? [{ id: "quantities", title: `${pendingQuantities.length} quantity increases are waiting`, detail: "The operator has verified extra stubble; admin approval updates the farmer listing.", meta: "Farmer updates", urgency: "today" as const, href: "/dispatch", actionLabel: "Review requests" }] : []),
    ...data.alerts.filter((item) => item.severity === "high").slice(0, 2).map((item) => ({ id: `alert-${item.id}`, title: item.title, detail: item.detail, meta: "Operational exception", urgency: "now" as const, href: item.href || "#admin-control-tabs", actionLabel: "Investigate" })),
  ];

  return <div className="mt-6">
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Season progress" value={`${number(data.reports.totalTonnes)} t`} note={`${progress.toFixed(0)}% of ${number(data.settings.seasonTargetTonnes)} t target`} icon={TrendingUp} />
      <Stat label="Farmer payments" value={inr(data.reports.totalFarmerPaidInr)} note={`${data.payments.filter((item) => item.reviewStatus === "pending").length} await review`} icon={IndianRupee} />
      <Stat label="Open approvals" value={String(pendingApplications.length + pendingQuantities.length)} note="Onboarding and quantity changes" icon={ClipboardCheck} />
      <Stat label="Operational alerts" value={String(data.alerts.filter((item) => item.severity !== "low").length)} note="Exceptions needing attention" icon={BellRing} />
    </div>

    <ActionQueue items={adminActions} title="Decisions waiting for UnpackOS" />

    <Tabs id="admin-control-tabs" defaultValue="overview" className="mt-6 rounded-lg border border-border bg-card p-2 sm:p-3">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-secondary/70 p-1.5">
        {[
          ["overview", "Overview"], ["approvals", "Approvals"], ["schedule", "Pickups"], ["payments", "Payments"], ["orders", "Orders"], ["machines", "Machines"], ["alerts", "Alerts"], ["reports", "Reports"], ["audit", "Audit"], ["sms", "SMS"], ["settings", "Settings"],
        ].map(([value, label]) => <TabsTrigger key={value} value={value} className="text-xs">{label}</TabsTrigger>)}
      </TabsList>

      <TabsContent value="overview" className="space-y-4 p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title={`${data.settings.seasonName} control room`} note="One view of collection, money, demand and exceptions.">
          <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
            <div><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Season target</p><p className="mt-2 font-display text-4xl">{number(data.reports.totalTonnes)} <span className="text-xl text-muted-foreground">/ {number(data.settings.seasonTargetTonnes)} t</span></p></div><p className="text-sm font-medium text-primary">{progress.toFixed(0)}%</p></div><Progress value={progress} className="mt-4 h-3" /><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-md bg-secondary p-3"><p className="text-[0.65rem] text-muted-foreground">Projected sales</p><p className="mt-1 font-display text-xl">{inr(data.reports.projectedSalesInr)}</p></div><div className="rounded-md bg-secondary p-3"><p className="text-[0.65rem] text-muted-foreground">Delivered batches</p><p className="mt-1 font-display text-xl">{data.reports.deliveredBatches}</p></div></div></div>
            <div className="space-y-2">{data.alerts.slice(0, 3).map((alert) => <div key={alert.id} className={`rounded-md border p-3 ${alert.severity === "high" ? "border-red-200 bg-red-50" : alert.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><p className="text-xs font-medium">{alert.title}</p><p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">{alert.detail}</p></div>)}</div>
          </div>
        </Panel>
        <div className="grid gap-4 md:grid-cols-3">{data.reports.clusters.map((cluster) => <article key={cluster.id} className="rounded-lg border border-border p-4"><div className="flex items-center justify-between"><MapPinned className="h-4 w-4 text-primary" /><Chip tone="green">{cluster.district}</Chip></div><h3 className="mt-3 font-display text-xl">{cluster.name}</h3><p className="mt-2 text-sm">{number(cluster.tonnes)} t coordinated</p><p className="mt-1 text-xs text-muted-foreground">{cluster.batches} batches · {cluster.acres} acres · {inr(cluster.paidInr)} paid</p></article>)}</div>
      </TabsContent>

      <TabsContent value="approvals" className="space-y-4 p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Registration requests" note="Final decisions remain with the UnpackOS organization." action={<Button asChild size="sm"><Link href="/dispatch">Open full onboarding</Link></Button>}>
          {pendingApplications.length ? <TableWrap><Head labels={["Applicant", "Type", "District", "Status", "Applied"]} /><tbody>{pendingApplications.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3"><p className="font-medium">{item.name}</p><p className="text-muted-foreground">{item.reference} · {item.phone}</p></td><td className="px-4 py-3 capitalize">{item.applicantType.replaceAll("_", " ")}</td><td className="px-4 py-3">{item.district}</td><td className="px-4 py-3"><Chip tone={item.status === "verified" ? "green" : "amber"}>{item.status.replaceAll("_", " ")}</Chip></td><td className="px-4 py-3">{date(item.appliedAt)}</td></tr>)}</tbody></TableWrap> : <Empty>No registration requests are awaiting a decision.</Empty>}
        </Panel>
        <Panel title="Verified quantity increases" note="Operators verify the field; admins approve the new listing total." action={<Button asChild size="sm" variant="outline"><Link href="/dispatch">Review requests</Link></Button>}>
          {pendingQuantities.length ? <TableWrap><Head labels={["Farmer", "Verified by", "Previous", "Increase", "New total", "Reason"]} /><tbody>{pendingQuantities.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-medium">{item.farmerName}</td><td className="px-4 py-3">{item.requestedByName}</td><td className="px-4 py-3">{number(item.previousTonnes)} t</td><td className="px-4 py-3 text-primary">+{number(item.additionalTonnes)} t</td><td className="px-4 py-3 font-medium">{number(item.requestedTotalTonnes)} t</td><td className="max-w-[260px] px-4 py-3 text-muted-foreground">{item.reason}</td></tr>)}</tbody></TableWrap> : <Empty>No verified quantity changes are awaiting approval.</Empty>}
        </Panel>
      </TabsContent>

      <TabsContent value="schedule" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Pickup calendar and assignments" note="The first confirmed date locks automatically. Changing it later requires an audit reason.">
          <div className="divide-y">{data.schedules.map((batch) => {
            const edit = scheduleEdits[batch.id] ?? {};
            const localDate = edit.pickupScheduledAt ?? (batch.pickupScheduledAt ? new Date(batch.pickupScheduledAt).toISOString().slice(0, 16) : "");
            return <div key={batch.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{batch.farmerName}</p><Chip tone={batch.pickupLockedAt ? "amber" : "neutral"}>{batch.pickupLockedAt ? "Date locked" : "Draft"}</Chip></div><p className="mt-1 text-xs text-muted-foreground">{batch.clusterName} · {number(batch.weightTonnes)} t · {batch.passportId}</p><Input className="mt-2 h-9" type="datetime-local" value={localDate} onChange={(event) => setScheduleEdits((all) => ({ ...all, [batch.id]: { ...edit, pickupScheduledAt: event.target.value } }))} /></div><label className="text-xs text-muted-foreground">Operator<select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-foreground" value={edit.assignedOperatorId ?? String(batch.assignedOperatorId ?? "")} onChange={(event) => setScheduleEdits((all) => ({ ...all, [batch.id]: { ...edit, assignedOperatorId: event.target.value } }))}><option value="">Unassigned</option>{operators.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label className="text-xs text-muted-foreground">Aggregator<select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-foreground" value={edit.assignedAggregatorId ?? String(batch.assignedAggregatorId ?? "")} onChange={(event) => setScheduleEdits((all) => ({ ...all, [batch.id]: { ...edit, assignedAggregatorId: event.target.value } }))}><option value="">Unassigned</option>{aggregators.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><div className="space-y-2"><Input className="h-9 min-w-[190px]" placeholder="Override reason if locked" value={edit.overrideReason ?? ""} onChange={(event) => setScheduleEdits((all) => ({ ...all, [batch.id]: { ...edit, overrideReason: event.target.value } }))} /><Button size="sm" className="w-full" onClick={() => scheduleMutation.mutate({ batchId: batch.id, body: { ...edit, pickupScheduledAt: localDate, assignedOperatorId: edit.assignedOperatorId ? Number(edit.assignedOperatorId) : batch.assignedOperatorId, assignedAggregatorId: edit.assignedAggregatorId ? Number(edit.assignedAggregatorId) : batch.assignedAggregatorId } })}><Save className="mr-2 h-3.5 w-3.5" />Save slot</Button></div></div>;
          })}</div>
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900"><strong>Buyer pickup rule:</strong> a confirmed pickup day cannot normally be changed. Missed pickup may result in a ₹15,000 charge after staff review.</div>
        </Panel>
      </TabsContent>

      <TabsContent value="payments" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Farmer payment review" note="Match the weighbridge record before releasing or reconciling payment.">
          <TableWrap><Head labels={["Farmer / batch", "Weighbridge", "Quantity", "Amount", "Review", "Actions"]} /><tbody>{data.payments.map((payment) => <tr key={payment.batchId} className="border-t"><td className="px-4 py-3"><p className="font-medium">{payment.farmerName}</p><p className="text-muted-foreground">{payment.passportId}</p></td><td className="px-4 py-3">{payment.weighbridgeId}</td><td className="px-4 py-3">{number(payment.weightTonnes)} t</td><td className="px-4 py-3 font-medium">{inr(payment.amountInr)}</td><td className="px-4 py-3"><Chip tone={payment.reviewStatus === "reconciled" ? "green" : payment.reviewStatus === "rejected" ? "red" : "amber"}>{payment.reviewStatus}</Chip></td><td className="px-4 py-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => paymentMutation.mutate({ batchId: payment.batchId, status: "approved" })}>Approve</Button><Button size="sm" onClick={() => paymentMutation.mutate({ batchId: payment.batchId, status: "reconciled" })}>Reconcile</Button><Button size="sm" variant="ghost" className="text-red-700" onClick={() => paymentMutation.mutate({ batchId: payment.batchId, status: "rejected", notes: "Returned for correction" })}>Reject</Button></div></td></tr>)}</tbody></TableWrap>
        </Panel>
      </TabsContent>

      <TabsContent value="orders" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Marketplace order decisions" note="Confirm partial volumes, reject invalid requests, and track delivery." action={<Button asChild size="sm"><Link href="/dispatch">Open order controls</Link></Button>}>
          {data.orders.length ? <TableWrap><Head labels={["Order", "Buyer", "Lot", "Volume", "Status", "Contact"]} /><tbody>{data.orders.map((order) => <tr key={order.id} className="border-t"><td className="px-4 py-3 font-medium">#{order.id}</td><td className="px-4 py-3">{order.company}</td><td className="px-4 py-3">{order.lotId}</td><td className="px-4 py-3">{number(order.tonnes)} t</td><td className="px-4 py-3"><Chip tone={order.status === "delivered" ? "green" : order.status === "rejected" ? "red" : "amber"}>{order.status}</Chip></td><td className="px-4 py-3"><a className="text-primary underline" href={`tel:+91${order.phone}`}>+91 {order.phone}</a></td></tr>)}</tbody></TableWrap> : <Empty>No marketplace orders yet.</Empty>}
        </Panel>
      </TabsContent>

      <TabsContent value="machines" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Machine and fleet availability" note="Track partner capacity, operating status, rates and servicing.">
          <div className="grid gap-3 p-4 md:grid-cols-2">{data.machines.map((machine) => <article key={machine.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{machine.machineType}</p><h4 className="mt-2 font-display text-xl">{machine.ownerName}</h4><p className="mt-1 text-xs text-muted-foreground">{machine.machineCount} units · {machine.district} · {machine.serviceRadiusKm} km radius</p></div><Tractor className="h-5 w-5 text-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2"><label className="text-[0.68rem] text-muted-foreground">Availability<select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs text-foreground" defaultValue={machine.status} onChange={(event) => machineMutation.mutate({ machineId: machine.id, body: { status: event.target.value } })}>{["available", "assigned", "maintenance", "offline"].map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-[0.68rem] text-muted-foreground">Rate per day<Input className="mt-1 h-9" type="number" defaultValue={machine.rateInrPerDay ?? ""} onBlur={(event) => machineMutation.mutate({ machineId: machine.id, body: { rateInrPerDay: Number(event.target.value) } })} /></label></div><p className="mt-3 text-xs text-muted-foreground">Window: {machine.availabilityWindow}</p></article>)}</div>
        </Panel>
      </TabsContent>

      <TabsContent value="alerts" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Operational alerts" note="Exceptions are prioritized by potential impact."><div className="grid gap-3 p-4 md:grid-cols-2">{data.alerts.map((alert) => <article key={alert.id} className={`rounded-lg border p-4 ${alert.severity === "high" ? "border-red-200 bg-red-50" : alert.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex gap-3">{alert.severity === "high" ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" /> : <BellRing className="h-5 w-5 shrink-0 text-amber-700" />}<div><div className="flex items-center gap-2"><p className="font-medium">{alert.title}</p><Chip tone={alert.severity === "high" ? "red" : alert.severity === "medium" ? "amber" : "green"}>{alert.severity}</Chip></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{alert.detail}</p>{alert.href && <Link href={alert.href} className="mt-3 inline-block text-xs font-medium text-primary underline">Open related workspace</Link>}</div></div></article>)}</div></Panel>
      </TabsContent>

      <TabsContent value="reports" className="space-y-4 p-1 pt-3 sm:p-2 sm:pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Tonnes coordinated" value={`${number(data.reports.totalTonnes)} t`} note="All pilot clusters" icon={PackageCheck} /><Stat label="Paid to farmers" value={inr(data.reports.totalFarmerPaidInr)} note={`At ${inr(data.settings.farmerRateInrPerTonne)}/t`} icon={IndianRupee} /><Stat label="Projected sales" value={inr(data.reports.projectedSalesInr)} note={`At ${inr(data.settings.saleRateInrPerTonne)}/t`} icon={TrendingUp} /><Stat label="Buyer requests" value={String(data.reports.requestedOrders)} note="Awaiting a decision" icon={UsersRound} /></div>
        <Panel title="Cluster performance" note="A concise operational report suitable for weekly review."><TableWrap><Head labels={["Cluster", "Acres", "Batches", "Tonnes", "Farmer payout"]} /><tbody>{data.reports.clusters.map((cluster) => <tr key={cluster.id} className="border-t"><td className="px-4 py-3"><p className="font-medium">{cluster.name}</p><p className="text-muted-foreground">{cluster.district}</p></td><td className="px-4 py-3">{number(cluster.acres)}</td><td className="px-4 py-3">{cluster.batches}</td><td className="px-4 py-3 font-medium">{number(cluster.tonnes)} t</td><td className="px-4 py-3">{inr(cluster.paidInr)}</td></tr>)}</tbody></TableWrap></Panel>
      </TabsContent>

      <TabsContent value="audit" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Organization audit history" note="Who changed what, when, and against which record.">
          {data.auditLog.length ? <div className="divide-y">{data.auditLog.map((event) => <div key={event.id} className="flex gap-3 px-5 py-4"><div className="mt-0.5 rounded-full bg-secondary p-2"><FileClock className="h-4 w-4 text-primary" /></div><div className="min-w-0"><p className="text-sm font-medium capitalize">{event.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorName} · {event.entityType} #{event.entityId} · {date(event.createdAt)}</p><p className="mt-1 truncate text-[0.65rem] text-muted-foreground">{Object.keys(event.details).length ? JSON.stringify(event.details) : "No additional details"}</p></div></div>)}</div> : <Empty>The first controlled action will appear here.</Empty>}
        </Panel>
      </TabsContent>

      <TabsContent value="sms" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Farmer SMS centre" note="Preview the exact message first, then send or resend it to the farmer's registered phone.">
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]"><div className="space-y-4"><label className="block text-xs text-muted-foreground">Farmer batch<select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-foreground" value={smsBatchId} onChange={(event) => setSmsBatchId(Number(event.target.value))}>{data.schedules.map((batch) => <option key={batch.id} value={batch.id}>{batch.farmerName} · {batch.passportId}</option>)}</select></label><label className="block text-xs text-muted-foreground">Message type<select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-foreground" value={smsKind} onChange={(event) => setSmsKind(event.target.value)}><option value="pickup">Pickup confirmation</option><option value="payment">Payment receipt</option><option value="registration">Registration confirmation</option></select></label><div className="flex gap-2"><Button variant="outline" onClick={() => smsMutation.mutate({ batchId: smsBatchId, kind: smsKind, send: false })}><MessageSquareText className="mr-2 h-4 w-4" />Preview</Button><Button onClick={() => smsMutation.mutate({ batchId: smsBatchId, kind: smsKind, send: true })}><MailCheck className="mr-2 h-4 w-4" />Send / resend</Button></div></div><div className="rounded-[1.5rem] border-[6px] border-primary bg-primary p-2 shadow-lg"><div className="rounded-[1rem] bg-background p-4"><p className="text-center text-[0.65rem] font-medium tracking-wider text-muted-foreground">UNPACKOS · NOW</p><div className="mt-4 rounded-2xl rounded-bl-sm bg-secondary p-4 text-sm leading-relaxed">{smsPreview || "Choose a batch and preview a message. No SMS is sent until you press Send / resend."}</div></div></div></div>
        </Panel>
      </TabsContent>

      <TabsContent value="settings" className="p-1 pt-3 sm:p-2 sm:pt-4">
        <Panel title="Pilot rules and economics" note="These values define the admin dashboard calculations and operating rules.">
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-muted-foreground">Season name<Input className="mt-1" value={settings.seasonName ?? ""} onChange={(event) => setSettings({ ...settings, seasonName: event.target.value })} /></label><label className="text-xs text-muted-foreground">Target tonnes<Input className="mt-1" type="number" value={settings.seasonTargetTonnes ?? ""} onChange={(event) => setSettings({ ...settings, seasonTargetTonnes: Number(event.target.value) })} /></label><label className="text-xs text-muted-foreground">Farmer rate ₹/t<Input className="mt-1" type="number" value={settings.farmerRateInrPerTonne ?? ""} onChange={(event) => setSettings({ ...settings, farmerRateInrPerTonne: Number(event.target.value) })} /></label><label className="text-xs text-muted-foreground">Sale rate ₹/t<Input className="mt-1" type="number" value={settings.saleRateInrPerTonne ?? ""} onChange={(event) => setSettings({ ...settings, saleRateInrPerTonne: Number(event.target.value) })} /></label><label className="text-xs text-muted-foreground">Commission %<Input className="mt-1" type="number" step="0.1" value={settings.commissionPct ?? ""} onChange={(event) => setSettings({ ...settings, commissionPct: Number(event.target.value) })} /></label><label className="text-xs text-muted-foreground">Missed pickup charge ₹<Input className="mt-1" type="number" value={settings.pickupPenaltyInr ?? ""} onChange={(event) => setSettings({ ...settings, pickupPenaltyInr: Number(event.target.value) })} /></label></div><div className="flex items-center justify-between gap-3 border-t bg-secondary/40 px-5 py-4"><p className="max-w-2xl text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4 text-primary" />Every change is tied to the signed-in administrator and added to the audit history.</p><Button onClick={() => settingsMutation.mutate(settings)}><Save className="mr-2 h-4 w-4" />Save settings</Button></div>
        </Panel>
      </TabsContent>
    </Tabs>
  </div>;
}
