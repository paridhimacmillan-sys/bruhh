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
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-4 px-4 h-11 border-b bg-card shrink-0">
        <div className="flex items-baseline gap-1.5 mr-2">
          <h1 className="font-bold text-sm leading-none">MachineTrack</h1>
          <span className="text-[10px] text-muted-foreground leading-none hidden sm:inline">
            Production Monitor
          </span>
        </div>

        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="text-right leading-tight hidden md:block">
            <p className="font-semibold text-[11px] truncate max-w-[180px]">
              {user.email ?? user.username}
            </p>
            <p className="text-[9px] text-muted-foreground capitalize">
              {user.role}
            </p>
          </div>
          <button
            onClick={() => logoutMut.mutate()}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            title="Sign out"
          >
            <LogOut size={12} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
