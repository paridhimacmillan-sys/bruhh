import { ArrowRight, CheckCircle2, Clock3, TriangleAlert, type LucideIcon } from "lucide-react";
import { Link } from "wouter";

export function DashboardStats({ items }: { items: Array<{ label: string; value: string; note: string; icon: LucideIcon }> }) {
  return <section className="grid gap-3 sm:grid-cols-3">{items.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-4 font-display text-3xl">{value}</p><p className="mt-2 text-[0.68rem] text-muted-foreground">{note}</p></article>)}</section>;
}

export function WorkspaceSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card"><header className="border-b border-border px-5 py-4"><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 font-display text-2xl">{title}</h2></header>{children}</section>;
}

export type ActionQueueItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  urgency?: "now" | "today" | "done";
  href?: string;
  actionLabel?: string;
};

const queueTone = {
  now: { icon: TriangleAlert, shell: "border-red-200 bg-red-50", iconClass: "text-red-700", label: "Act now" },
  today: { icon: Clock3, shell: "border-amber-200 bg-amber-50", iconClass: "text-amber-700", label: "Today" },
  done: { icon: CheckCircle2, shell: "border-emerald-200 bg-emerald-50", iconClass: "text-emerald-700", label: "On track" },
};

export function ActionQueue({ title = "What needs your attention", items, emptyMessage = "Nothing urgent. Your work is on track." }: { title?: string; items: ActionQueueItem[]; emptyMessage?: string }) {
  return <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><p className="eyebrow">Today</p><h2 className="mt-2 font-display text-2xl sm:text-3xl">{title}</h2></div>
      <p className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">{items.length} open</p>
    </div>
    {items.length ? <div className="mt-4 grid gap-3 xl:grid-cols-3">{items.slice(0, 6).map((item) => {
      const tone = queueTone[item.urgency ?? "today"];
      const Icon = tone.icon;
      const content = <><div className="flex items-start justify-between gap-3"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.iconClass}`} /><span className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{tone.label}</span></div><h3 className="mt-3 text-sm font-semibold leading-snug">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>{item.meta && <p className="mt-3 text-[0.68rem] font-medium text-foreground/70">{item.meta}</p>}{item.href && <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">{item.actionLabel ?? "Open"}<ArrowRight className="h-3.5 w-3.5" /></span>}</>;
      return item.href ? <Link key={item.id} href={item.href} className={`block min-h-[178px] rounded-lg border p-4 transition-transform hover:-translate-y-0.5 ${tone.shell}`}>{content}</Link> : <article key={item.id} className={`min-h-[178px] rounded-lg border p-4 ${tone.shell}`}>{content}</article>;
    })}</div> : <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5" />{emptyMessage}</div>}
  </section>;
}

export function WorkflowSteps({ steps }: { steps: Array<{ label: string; detail: string; state: "done" | "current" | "upcoming" }> }) {
  return <ol className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">{steps.map((step, index) => <li key={step.label} className={`relative rounded-lg border p-4 ${step.state === "current" ? "border-primary bg-primary/5" : step.state === "done" ? "border-emerald-200 bg-emerald-50" : "border-border bg-secondary/25"}`}><div className="flex items-center gap-2"><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step.state === "done" ? "bg-emerald-700 text-white" : step.state === "current" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{step.state === "done" ? "✓" : index + 1}</span><p className="text-sm font-semibold">{step.label}</p></div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{step.detail}</p></li>)}</ol>;
}
