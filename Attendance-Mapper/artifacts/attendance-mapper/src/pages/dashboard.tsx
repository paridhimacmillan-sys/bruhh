import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Users, CalendarCheck, Clock, AlertCircle, TrendingUp, Building2, UserCheck, UserX, ArrowRight, ChevronUp, IndianRupee } from "lucide-react";
import { format } from "date-fns";

const inr = (n: number) => n.toLocaleString("en-IN");

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  const statCards = [
    {
      label: "Total Employees",
      key: "totalEmployees",
      icon: Users,
      color: "#6366f1",
      bg: "#eef2ff",
      change: null,
    },
    {
      label: "Present Today",
      key: "todayPresent",
      icon: UserCheck,
      color: "#16a34a",
      bg: "#f0fdf4",
      change: null,
    },
    {
      label: "Absent Today",
      key: "todayAbsent",
      icon: UserX,
      color: "#dc2626",
      bg: "#fef2f2",
      change: null,
    },
    {
      label: "On Leave",
      key: "todayOnLeave",
      icon: AlertCircle,
      color: "#d97706",
      bg: "#fffbeb",
      change: null,
    },
    {
      label: "Today's Rate",
      key: "todayAttendanceRate",
      icon: TrendingUp,
      color: "#0891b2",
      bg: "#ecfeff",
      suffix: "%",
    },
    {
      label: "Month Rate",
      key: "monthAttendanceRate",
      icon: TrendingUp,
      color: "#7c3aed",
      bg: "#f5f3ff",
      suffix: "%",
    },
    {
      label: "Zones",
      key: "totalDepartments",
      icon: Building2,
      color: "#0f766e",
      bg: "#f0fdfa",
      change: null,
    },
    {
      label: "OT Hours / Month",
      key: "overtimeHoursThisMonth",
      icon: Clock,
      color: "#b45309",
      bg: "#fefce8",
      change: null,
    },
  ] as const;

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .stat-card { background: white; border-radius: 12px; padding: 20px; border: 1px solid #f1f5f9; transition: box-shadow 0.15s, transform 0.15s; cursor: default; }
        .stat-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .quick-action { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: white; font-size: 13.5px; font-weight: 500; color: #374151; cursor: pointer; transition: all 0.12s; text-decoration: none; }
        .quick-action:hover { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
        .quick-action.primary { background: #6366f1; border-color: #6366f1; color: white; }
        .quick-action.primary:hover { background: #4f46e5; border-color: #4f46e5; color: white; }
        .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; color: #9ca3af; text-transform: uppercase; margin-bottom: 12px; }
        .rate-bar-track { height: 6px; border-radius: 3px; background: #f1f5f9; overflow: hidden; margin-top: 8px; }
        .rate-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Good morning 👋</div>
          <div style={{ fontSize: 13.5, color: "#9ca3af", marginTop: 3 }}>{today}</div>
        </div>
        <Link href="/attendance">
          <a className="quick-action primary" style={{ gap: 8, paddingRight: 20 }}>
            <CalendarCheck size={15} />
            Mark Today's Attendance
            <ArrowRight size={14} style={{ marginLeft: 4 }} />
          </a>
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginBottom: 28 }}>
        {statCards.map((s) => {
          const val = data?.[s.key as keyof typeof data];
          const displayVal = isLoading || val === undefined ? "—" : `${val}${"suffix" in s && s.suffix ? s.suffix : ""}`;
          const isRate = "suffix" in s && s.suffix === "%";
          return (
            <div key={s.key} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <s.icon size={17} color={s.color} />
                </div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {isLoading ? (
                  <div style={{ width: 60, height: 28, borderRadius: 6, background: "#f1f5f9", animation: "pulse 1.5s infinite" }} />
                ) : displayVal}
              </div>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 5, fontWeight: 450 }}>{s.label}</div>
              {isRate && !isLoading && typeof val === "number" && (
                <div className="rate-bar-track">
                  <div className="rate-bar-fill" style={{ width: `${val}%`, background: s.color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions + alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

        {/* Quick actions */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #f1f5f9" }}>
          <div className="section-label">Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { href: "/attendance",      label: "Mark Attendance",  icon: CalendarCheck, desc: "Log today's punches"         },
              { href: "/employees",       label: "View Employees",   icon: Users,         desc: "Browse all 155 employees"    },
              { href: "/payroll",         label: "Open Payroll",     icon: IndianRupee,   desc: "Review & export payroll"     },
              { href: "/reports/zones",   label: "Zone Summary",     icon: Building2,     desc: "Attendance by department"    },
              { href: "/reports/monthly", label: "Monthly Report",   icon: TrendingUp,    desc: "Full attendance breakdown"   },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <a className="quick-action" style={{ justifyContent: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <a.icon size={15} color="#6366f1" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{a.label}</div>
                    <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{a.desc}</div>
                  </div>
                  <ArrowRight size={13} color="#d1d5db" />
                </a>
              </Link>
            ))}
          </div>
        </div>

        {/* Attendance snapshot */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #f1f5f9" }}>
          <div className="section-label">Today's Snapshot</div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ height: 44, borderRadius: 8, background: "#f8fafc", animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          ) : data ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Present",    val: data.todayPresent,   total: data.totalEmployees, color: "#16a34a", bg: "#f0fdf4" },
                { label: "Absent",     val: data.todayAbsent,    total: data.totalEmployees, color: "#dc2626", bg: "#fef2f2" },
                { label: "On Leave",   val: data.todayOnLeave,   total: data.totalEmployees, color: "#d97706", bg: "#fffbeb" },
              ].map((row) => {
                const pct = data.totalEmployees > 0 ? Math.round((row.val / data.totalEmployees) * 100) : 0;
                return (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9, background: row.bg }}>
                    <div style={{ width: 52, fontSize: 11.5, fontWeight: 600, color: row.color }}>{row.label}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: row.color, borderRadius: 3, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", width: 28, textAlign: "right" }}>{row.val}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", width: 32 }}>{pct}%</div>
                  </div>
                );
              })}

              {/* Attendance rate callout */}
              <div style={{ marginTop: 6, padding: "14px 16px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white" }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>Today's attendance rate</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>{data.todayAttendanceRate}%</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Month avg: {data.monthAttendanceRate}%</div>
              </div>

              {data.pendingLeaveRequests > 0 && (
                <Link href="/leaves">
                  <a style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 9, background: "#fffbeb", border: "1.5px solid #fde68a", textDecoration: "none" }}>
                    <AlertCircle size={15} color="#d97706" />
                    <span style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>
                      {data.pendingLeaveRequests} pending leave {data.pendingLeaveRequests === 1 ? "request" : "requests"}
                    </span>
                    <ArrowRight size={13} color="#d97706" style={{ marginLeft: "auto" }} />
                  </a>
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
