import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthMeQueryKey, useAuthLogout, useAuthMe, type AuthUser, type UserRole } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { ClipboardCheck, LayoutDashboard, LogOut, MapPin, Settings, Tractor, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const homeByRole: Record<UserRole, string> = {
  admin: "/admin",
  coordinator: "/dispatch",
  inspector: "/inspector",
  operator: "/operator",
  aggregator: "/aggregator",
};

const navByRole: Record<UserRole, Array<{ href: string; label: string; icon: typeof LayoutDashboard }>> = {
  admin: [
    { href: "/admin", label: "Organization", icon: LayoutDashboard },
    { href: "/dispatch", label: "Dispatch control", icon: Truck },
    { href: "/market", label: "Public market", icon: Tractor },
  ],
  coordinator: [{ href: "/dispatch", label: "Dispatch control", icon: LayoutDashboard }],
  inspector: [
    { href: "/inspector", label: "Field inspections", icon: ClipboardCheck },
    { href: "/application-status", label: "Application lookup", icon: MapPin },
  ],
  operator: [
    { href: "/operator", label: "Field operations", icon: LayoutDashboard },
    { href: "/market", label: "Market lots", icon: Truck },
  ],
  aggregator: [
    { href: "/aggregator", label: "Machine workspace", icon: Tractor },
    { href: "/market", label: "Market demand", icon: Truck },
  ],
};

export function RoleDashboardShell({ allowedRoles, eyebrow, title, description, children }: { allowedRoles: UserRole[]; eyebrow: string; title: string; description: string; children: (user: AuthUser) => ReactNode }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, error } = useAuthMe({ query: { queryKey: getAuthMeQueryKey(), retry: false } });
  const logout = useAuthLogout({ mutation: { onSuccess: () => { queryClient.clear(); navigate("/login", { replace: true }); } } });
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "1";
  const previewRole = window.location.pathname.split("/")[1] as UserRole;
  const previewUser: AuthUser = { id: 1, name: `${previewRole[0]?.toUpperCase()}${previewRole.slice(1)} Preview`, email: `${previewRole}@unpackos.in`, phone: "9876500001", role: previewRole };
  const activeUser = preview ? previewUser : user;

  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (!preview && status === 401) navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    if (!preview && user && !allowedRoles.includes(user.role)) navigate(homeByRole[user.role], { replace: true });
  }, [allowedRoles, error, navigate, preview, user]);

  if (!preview && (isLoading || !user || !allowedRoles.includes(user.role))) return <div className="min-h-screen animate-pulse bg-background p-8"><div className="h-10 w-48 rounded bg-secondary" /><div className="mt-8 h-80 rounded-lg bg-secondary" /></div>;
  if (!activeUser) return null;

  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[220px_1fr]">
    <aside className="border-b border-border bg-primary px-5 py-5 text-primary-foreground lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
      <Link href="/" className="font-display text-2xl">UnpackOS</Link>
      <p className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-primary-foreground/65">{activeUser.role} workspace</p>
      <nav className="mt-5 flex gap-2 overflow-x-auto lg:mt-10 lg:grid" aria-label="Staff navigation">
        {navByRole[activeUser.role].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-fit items-center gap-2 rounded-md px-3 py-2.5 text-sm ${window.location.pathname === href ? "bg-straw text-straw-foreground" : "text-primary-foreground/80 hover:bg-primary-foreground/10"}`}><Icon className="h-4 w-4" />{label}</Link>)}
      </nav>
      <div className="mt-6 hidden border-t border-primary-foreground/20 pt-5 lg:block">
        <p className="text-sm font-medium">{activeUser.name}</p><p className="mt-1 text-xs text-primary-foreground/65">{activeUser.email}</p>
        <Button className="mt-4 w-full border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10" variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
      </div>
    </aside>
    <main className="min-w-0 px-5 py-7 md:px-8 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs"><Users className="h-4 w-4 text-primary" />{activeUser.name}<Settings className="ml-1 h-3.5 w-3.5 text-muted-foreground" /></div>
      </header>
      <div className="mt-8">{children(activeUser)}</div>
    </main>
  </div>;
}
