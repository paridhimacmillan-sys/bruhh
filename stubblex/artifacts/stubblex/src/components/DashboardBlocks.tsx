import type { LucideIcon } from "lucide-react";

export function DashboardStats({ items }: { items: Array<{ label: string; value: string; note: string; icon: LucideIcon }> }) {
  return <section className="grid gap-3 sm:grid-cols-3">{items.map(({ label, value, note, icon: Icon }) => <article key={label} className="rounded-lg border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div><p className="mt-4 font-display text-3xl">{value}</p><p className="mt-2 text-[0.68rem] text-muted-foreground">{note}</p></article>)}</section>;
}

export function WorkspaceSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="mt-6 overflow-hidden rounded-lg border border-border bg-card"><header className="border-b border-border px-5 py-4"><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 font-display text-2xl">{title}</h2></header>{children}</section>;
}
