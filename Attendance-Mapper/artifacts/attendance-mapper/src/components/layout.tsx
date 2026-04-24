import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import {
  LayoutDashboard, CalendarCheck, Users, Building2, Clock, Plane,
  FileSpreadsheet, Calendar, AlertTriangle, ClipboardList, IndianRupee, FileText, BarChart2,
} from "lucide-react";

interface LayoutProps { children: ReactNode; }

const navGroups = [
  {
    label: "DAILY",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/attendance", label: "Mark Attendance", icon: CalendarCheck },
      { href: "/sheet", label: "Sheet", icon: FileSpreadsheet },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/departments", label: "Zones", icon: Building2 },
      { href: "/overtime", label: "Overtime", icon: Clock },
      { href: "/leaves", label: "Leaves", icon: Plane },
    ],
  },
  {
    label: "PAYROLL",
    items: [
      { href: "/payroll", label: "Payroll", icon: IndianRupee },
      { href: "/form-12", label: "Form 12", icon: FileText },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports/daily", label: "Daily", icon: Calendar },
      { href: "/reports/monthly", label: "Monthly", icon: ClipboardList },
      { href: "/reports/absenteeism", label: "Absenteeism", icon: AlertTriangle },
      { href: "/reports/zones", label: "Zone Summary", icon: BarChart2 },
    ],
  },
];

const flat = navGroups.flatMap((g) => g.items);

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');`}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b-2 border-zinc-900 bg-zinc-900 print:hidden">
        <div className="flex h-12 items-center px-4 gap-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 pr-6 border-r border-zinc-700 mr-4 hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center bg-amber-400 text-zinc-900">
              <CalendarCheck className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="text-white text-xs font-bold tracking-[0.15em] uppercase">Premier Pin</div>
              <div className="text-zinc-500 text-[9px] tracking-[0.2em] uppercase">Attendance & Payroll</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-stretch h-12 flex-1 gap-0">
            {navGroups.map((group, gi) => (
              <div key={group.label} className={`flex items-stretch ${gi < navGroups.length - 1 ? "border-r border-zinc-700" : ""}`}>
                <div className="flex items-center px-3 text-[9px] font-bold tracking-[0.2em] text-zinc-600 uppercase select-none w-14 justify-center border-r border-zinc-800">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-1.5 px-3 text-xs font-medium border-r border-zinc-800 transition-colors ${
                        active
                          ? "bg-amber-400 text-zinc-900"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Mobile nav */}
        <div className="xl:hidden border-t border-zinc-800 overflow-x-auto bg-zinc-900">
          <nav className="flex h-9 w-max">
            {flat.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap border-r border-zinc-800 transition-colors ${
                    active ? "bg-amber-400 text-zinc-900" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 container mx-auto max-w-screen-2xl px-4 py-6 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
