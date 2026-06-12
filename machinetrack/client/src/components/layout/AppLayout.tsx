import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ClipboardList,
  Database,
  Users as UsersIcon,
  ScrollText,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";
import type { User } from "@shared/schema";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";

interface Props {
  user: User;
  children: React.ReactNode;
}

const ADMIN_NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/masters", label: "Masters", icon: Database },
  { href: "/production-entry", label: "Production Entry", icon: ClipboardList },
  { href: "/recent", label: "Recent Entries", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/users", label: "Users", icon: UsersIcon },
];

const OPERATOR_NAV = [
  { href: "/production-entry", label: "Production Entry", icon: ClipboardList },
];

export default function AppLayout({ user, children }: Props) {
  const [location] = useLocation();
  const isOperator = user.role === "employee";
  const nav = isOperator ? OPERATOR_NAV : ADMIN_NAV;

  const logoutMut = useMutation({
    mutationFn: () => api("/api/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return (
    <div className="flex h-screen">
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg">MachineTrack</h1>
          <p className="text-xs text-muted-foreground">Production Monitor</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-sm">
          <p className="font-semibold truncate">
            {user.email ?? user.username}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          <button
            onClick={() => logoutMut.mutate()}
            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
