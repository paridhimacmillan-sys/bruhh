import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";
import {
  LayoutDashboard, CalendarCheck, Users, Building2, Clock, Plane,
  FileSpreadsheet, Calendar, AlertTriangle, ClipboardList, IndianRupee,
  FileText, BarChart2, ChevronDown, Menu, X, LayoutGrid, ExternalLink,
} from "lucide-react";

interface LayoutProps { children: ReactNode; }

const navGroups = [
  {
    label: "Daily",
    items: [
      { href: "/",           label: "Dashboard",       icon: LayoutDashboard },
      { href: "/attendance", label: "Mark Attendance", icon: CalendarCheck   },
      { href: "/sheet",      label: "Sheet",           icon: FileSpreadsheet },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/employees",   label: "Employees",  icon: Users     },
      { href: "/departments", label: "Zones",      icon: Building2 },
      { href: "/overtime",    label: "Overtime",   icon: Clock     },
      { href: "/leaves",      label: "Leaves",     icon: Plane     },
    ],
  },
  {
    label: "Payroll",
    items: [
      { href: "/payroll",  label: "Payroll",  icon: IndianRupee },
      { href: "/form-12",  label: "Form 12",  icon: FileText    },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/daily",        label: "Daily",        icon: Calendar      },
      { href: "/reports/monthly",      label: "Monthly",      icon: ClipboardList },
      { href: "/reports/absenteeism",  label: "Absenteeism",  icon: AlertTriangle },
      { href: "/reports/zones",        label: "Zone Summary", icon: BarChart2     },
    ],
  },
];

const flat = navGroups.flatMap((g) => g.items);

const APPS = [
  {
    id: "attendance",
    name: "Attendance Mapper",
    description: "Attendance & payroll",
    url: "https://attendance.aicreator.co.in",
    icon: "🟢",
    current: true,
  },
  {
    id: "rejection",
    name: "Rejection Mapper",
    description: "Parts rejection tracker",
    url: "https://aicreator.co.in",
    icon: "🔴",
    current: false,
  },
];

function AppSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, fontWeight: 450, transition: "all 0.12s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#e5e7eb"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#6b7280"; }}
      >
        <LayoutGrid size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>Switch App</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "#1a1a1b", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", zIndex: 100 }}>
          {APPS.map((app) => (
            <a
              key={app.id}
              href={app.current ? undefined : app.url}
              onClick={app.current ? (e) => e.preventDefault() : undefined}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textDecoration: "none", cursor: app.current ? "default" : "pointer", opacity: app.current ? 0.5 : 1, background: app.current ? "rgba(255,255,255,0.03)" : "transparent", transition: "background 0.12s" }}
              onMouseEnter={e => { if (!app.current) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!app.current) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18 }}>{app.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.name}</div>
                <div style={{ color: "#6b7280", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.description}</div>
              </div>
              {app.current ? (
                <span style={{ fontSize: 10, background: "rgba(99,102,241,0.2)", color: "#818cf8", padding: "2px 8px", borderRadius: 20, fontWeight: 600, flexShrink: 0 }}>Active</span>
              ) : (
                <ExternalLink size={12} style={{ color: "#6b7280", flexShrink: 0 }} />
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location === href || location.startsWith(href + "/");

  const currentPage = flat.find((i) => isActive(i.href));

  return (
    <div className="min-h-screen flex" style={{ background: "#0f0f10", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .nav-item { display: flex; align-items: center; gap: 9px; padding: 7px 10px; border-radius: 7px; font-size: 13px; font-weight: 450; color: #6b7280; transition: all 0.12s; cursor: pointer; text-decoration: none; }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #e5e7eb; }
        .nav-item.active { background: rgba(255,255,255,0.08); color: #f9fafb; }
        .nav-item .icon { opacity: 0.6; transition: opacity 0.12s; }
        .nav-item:hover .icon, .nav-item.active .icon { opacity: 1; }
        .sidebar-section { font-size: 10.5px; font-weight: 600; color: #374151; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; margin: 16px 0 4px; }
        .main-content { flex: 1; min-width: 0; background: #f9fafb; border-radius: 12px 0 0 12px; min-height: 100vh; }
        @media (max-width: 1024px) { .main-content { border-radius: 0; } }
      `}</style>

      {/* Sidebar */}
      <aside
        className={`shrink-0 flex flex-col transition-all duration-200 print:hidden
          ${mobileOpen ? "fixed inset-0 z-50" : "hidden lg:flex"}
        `}
        style={{ width: 220, padding: "0 12px" }}
      >
        {/* Logo */}
        <div style={{ padding: "20px 10px 16px" }}>
          <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CalendarCheck size={16} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ color: "#f9fafb", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>Premier Pin</div>
              <div style={{ color: "#4b5563", fontSize: 10.5, lineHeight: 1.2, marginTop: 1 }}>Attendance & Payroll</div>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", paddingBottom: 20 }}>
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="sidebar-section">{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon size={15} className="icon" />
                    {item.label}
                    {active && (
                      <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom info */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 12 }}>
          <AppSwitcher />
          <div style={{ fontSize: 11, color: "#374151" }}>
            <div style={{ color: "#6b7280", marginBottom: 2 }}>Logged in as</div>
            <div style={{ color: "#9ca3af", fontWeight: 500 }}>Administrator</div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="main-content flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-30 print:hidden" style={{ background: "rgba(249,250,251,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mobile menu toggle */}
            <button
              className="lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", color: "#6b7280" }}
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <span style={{ color: "#9ca3af" }}>Premier Pin</span>
              <span style={{ color: "#d1d5db" }}>/</span>
              <span style={{ color: "#111827", fontWeight: 500 }}>{currentPage?.label ?? "Dashboard"}</span>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 600 }}>
                A
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "28px 24px", maxWidth: 1400 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
