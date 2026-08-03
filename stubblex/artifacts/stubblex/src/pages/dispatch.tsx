import {
  ArrowUpRight,
  CheckCircle2,
  IndianRupee,
  Leaf,
  MessageSquareText,
  MoreHorizontal,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAuthMeQueryKey,
  getListBatchesQueryKey,
  getListOrdersQueryKey,
  useAuthLogout,
  useAuthMe,
  useListBatches,
  useListOrders,
  useUpdateBatchStatus,
  useUpdateOrderStatus,
  type Batch,
  type BatchStatus,
  type Order,
  type OrderStatusUpdateStatus,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SmsPreviewPanel } from "@/components/SmsPreviewPanel";
import { OnboardingPanel } from "@/components/OnboardingPanel";

const SEASON_TARGET_TONNES = 3_400;

const statusStyles: Record<BatchStatus, string> = {
  registered: "border-border bg-secondary text-muted-foreground",
  baled: "border-straw bg-straw/45 text-straw-foreground",
  paid: "border-primary/20 bg-primary/10 text-primary",
  delivered: "border-primary bg-primary text-primary-foreground",
};

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function StatusChip({ status }: { status: BatchStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

function DashboardLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl animate-pulse px-5 py-10 md:px-8">
      <div className="h-10 w-52 rounded bg-secondary" />
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-32 rounded-lg bg-secondary" />)}
      </div>
      <div className="mt-6 h-28 rounded-lg bg-secondary" />
      <div className="mt-6 h-96 rounded-lg bg-secondary" />
    </main>
  );
}

function DashboardError() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12 text-center">
      <div className="max-w-sm rounded-lg border border-border bg-card p-8">
        <p className="eyebrow">Dispatch control</p>
        <h1 className="mt-3 font-display text-3xl">Unable to load batches</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Check the data connection and refresh the dashboard.</p>
      </div>
    </main>
  );
}

function BatchTable({ batches, canManage, onMarkPaid, onPreviewSms, pendingBatchId }: { batches: Batch[]; canManage: boolean; onMarkPaid: (batch: Batch) => void; onPreviewSms: (batch: Batch) => void; pendingBatchId: number | null }) {
  if (batches.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-display text-2xl">No batches yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Registered batches will appear here as the season begins.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-secondary/70">
            {[
              "Passport",
              "Status",
              "Baled",
              "Weight",
              "Farmer paid",
              "Buyer",
              "Distance",
              "Actions",
            ].map((heading) => (
              <th key={heading} scope="col" className="px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id} className="border-b border-border/70 last:border-0 hover:bg-secondary/45">
              <td className="px-5 py-4">
                <Link href={`/p/${batch.passportId}`} className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primary">
                  {batch.passportId}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link href={`/r/${batch.id}?lang=pa`} className="mt-1.5 block text-[0.65rem] font-medium text-muted-foreground hover:text-primary">
                  View farmer receipt
                </Link>
              </td>
              <td className="px-5 py-4"><StatusChip status={batch.status} /></td>
              <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">{formatDate(batch.baledAt)}</td>
              <td className="whitespace-nowrap px-5 py-4 text-sm font-medium">{formatNumber(batch.weightTonnes, 2)} t</td>
              <td className="whitespace-nowrap px-5 py-4 text-sm font-medium">{formatInr(batch.farmerPaidInr)}</td>
              <td className="max-w-52 truncate px-5 py-4 text-sm text-muted-foreground">{batch.buyerName}</td>
              <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">{batch.distanceKm} km</td>
              <td className="px-5 py-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={`Actions for ${batch.passportId}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {(batch.status === "paid" || batch.status === "delivered") && <DropdownMenuItem onSelect={() => onPreviewSms(batch)}><MessageSquareText className="mr-2 h-4 w-4" /> Preview SMS</DropdownMenuItem>}
                    {canManage && batch.status !== "paid" && batch.status !== "delivered" && <DropdownMenuItem disabled={pendingBatchId === batch.id} onSelect={() => onMarkPaid(batch)}>Mark as paid</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTable({ orders, canDecide }: { orders: Order[]; canDecide: boolean }) {
  const queryClient = useQueryClient();
  const update = useUpdateOrderStatus({ mutation: { onSuccess: async () => { await queryClient.invalidateQueries(); } } });
  const decide = (orderId: number, status: OrderStatusUpdateStatus) => update.mutate({ orderId, data: { status } });
  if (orders.length === 0) return <div className="px-6 py-16 text-center"><p className="font-display text-2xl">No buyer requests yet</p><p className="mt-2 text-sm text-muted-foreground">New requests from the public market will appear here.</p></div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] border-collapse text-left"><thead><tr className="border-b border-border bg-secondary/70">{["Order","Lot","Buyer","Phone","Requested","Status","Action"].map((heading) => <th key={heading} className="px-5 py-3 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">{heading}</th>)}</tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-4 font-mono text-xs">#{order.id}</td><td className="px-5 py-4"><Link href={`/market/${order.lotId}`} className="font-mono text-xs font-medium text-primary">{order.lotId}</Link><p className="mt-1 text-[0.65rem] text-muted-foreground">Lot {formatNumber(order.lotTonnes)} t</p></td><td className="px-5 py-4 text-sm font-medium">{order.company}</td><td className="px-5 py-4 text-sm text-muted-foreground">{order.phone}</td><td className="px-5 py-4 text-sm font-medium">{formatNumber(order.tonnes, 2)} t</td><td className="px-5 py-4"><span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[0.65rem] font-medium capitalize">{order.status}</span></td><td className="px-5 py-4"><div className="flex gap-2">{order.status === "requested" && canDecide && <><Button size="sm" onClick={() => decide(order.id, "confirmed")}>Confirm</Button><Button size="sm" variant="outline" onClick={() => decide(order.id, "rejected")}>Reject</Button></>}{order.status === "confirmed" && canDecide && <Button size="sm" onClick={() => decide(order.id, "delivered")}>Mark delivered</Button>}{!canDecide && <span className="text-xs text-muted-foreground">Coordinator approval</span>}</div></td></tr>)}</tbody></table></div>;
}

export function DispatchPage() {
  const [activeTab, setActiveTab] = useState<"batches" | "orders" | "onboarding">("batches");
  const [smsBatch, setSmsBatch] = useState<Batch | null>(null);
  const [pendingBatchId, setPendingBatchId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: authLoading, error: authError } = useAuthMe({
    query: { queryKey: getAuthMeQueryKey(), retry: false },
  });
  const { data: batches, isLoading, error } = useListBatches({
    query: { queryKey: getListBatchesQueryKey(), retry: false, enabled: Boolean(user) },
  });
  const { data: orders = [] } = useListOrders({ query: { queryKey: getListOrdersQueryKey(), retry: false, enabled: Boolean(user) } });
  const updateBatchStatus = useUpdateBatchStatus({
    mutation: {
      onSuccess: async (updated) => {
        await queryClient.invalidateQueries({ queryKey: getListBatchesQueryKey() });
        setPendingBatchId(null);
        if (updated.status === "paid") setSmsBatch(updated);
      },
      onError: () => setPendingBatchId(null),
    },
  });
  const logout = useAuthLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        navigate("/login", { replace: true });
      },
    },
  });

  useEffect(() => {
    const status = (authError as { status?: number } | null)?.status;
    if (status === 401) navigate("/login?returnTo=/dispatch", { replace: true });
  }, [authError, navigate]);

  if (authLoading || (user && isLoading)) return <DashboardLoading />;
  if (!user) return authError && (authError as { status?: number }).status !== 401 ? <DashboardError /> : <DashboardLoading />;
  if (error || !batches) return <DashboardError />;

  const totalTonnes = batches.reduce((total, batch) => total + batch.weightTonnes, 0);
  const totalPaid = batches.reduce((total, batch) => total + batch.farmerPaidInr, 0);
  const delivered = batches.filter((batch) => batch.status === "delivered").length;
  const progress = Math.min((totalTonnes / SEASON_TARGET_TONNES) * 100, 100);
  const canManageBatches = user.role === "admin" || user.role === "coordinator";
  const canAccessOnboarding = canManageBatches || user.role === "inspector";
  const markPaid = (batch: Batch) => {
    setPendingBatchId(batch.id);
    updateBatchStatus.mutate({ passportId: batch.passportId, data: { status: "paid", simulateNotification: true } });
  };

  const totals = [
    { icon: Leaf, label: "Total tonnes diverted", value: `${formatNumber(totalTonnes, 2)} t` },
    { icon: IndianRupee, label: "Paid to farmers", value: formatInr(totalPaid) },
    { icon: CheckCircle2, label: "Batches delivered", value: formatNumber(delivered, 0) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="font-display text-lg tracking-tight" aria-label="StubbleX home">
            Stubble<span className="text-primary">X</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-foreground">{user.name}</p>
              <p className="text-[0.65rem] capitalize text-muted-foreground">{user.role}</p>
            </div>
            <Button size="sm" variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Dispatch control</p>
            <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">Sangrur pilot</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">A live view of residue moving from registered fields to verified industrial buyers.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            <Truck className="h-4 w-4 text-primary" aria-hidden="true" /> {batches.length} batches in ledger
          </div>
        </div>

        <section aria-label="Season totals" className="mt-8 grid gap-3 sm:grid-cols-3">
          {totals.map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-3xl tracking-tight">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-lg border border-border bg-card p-5 sm:p-6" aria-labelledby="season-progress-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p id="season-progress-title" className="text-sm font-medium">Season: Sangrur pilot — target 3,400 t</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(totalTonnes, 2)} tonnes verified so far</p>
            </div>
            <p className="font-display text-2xl">{formatNumber(progress)}%</p>
          </div>
          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Sangrur pilot progress"
            aria-valuemin={0}
            aria-valuemax={SEASON_TARGET_TONNES}
            aria-valuenow={Math.round(totalTonnes)}
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="batch-ledger-title">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="eyebrow">Dispatch workspace</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setActiveTab("batches")} className={`rounded-full px-3 py-1.5 text-sm ${activeTab === "batches" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Batches · {batches.length}</button>
                <button onClick={() => setActiveTab("orders")} className={`rounded-full px-3 py-1.5 text-sm ${activeTab === "orders" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Orders · {orders.length}</button>
                {canAccessOnboarding && <button onClick={() => setActiveTab("onboarding")} className={`rounded-full px-3 py-1.5 text-sm ${activeTab === "onboarding" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Onboarding</button>}
              </div>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">Scroll horizontally on small screens</p>
          </div>
          {activeTab === "batches" && <BatchTable batches={batches} canManage={canManageBatches} onMarkPaid={markPaid} onPreviewSms={setSmsBatch} pendingBatchId={pendingBatchId} />}
          {activeTab === "orders" && <OrderTable orders={orders} canDecide={canManageBatches} />}
          {activeTab === "onboarding" && canAccessOnboarding && <OnboardingPanel canDecide={canManageBatches} />}
        </section>
      </main>
      {smsBatch && <SmsPreviewPanel batch={smsBatch} onDismiss={() => setSmsBatch(null)} />}
    </div>
  );
}
