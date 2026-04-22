import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { useEffect } from "react";
import {
  Building2, Clock, FileText, Plane, Calendar,
  AlertTriangle, ArrowRight, ClipboardList,
} from "lucide-react";

const SECTIONS = [
  { href: "/departments",        label: "Zones / Departments", icon: Building2,    desc: "Manage factory zones",           hd: "bg-zinc-700"   },
  { href: "/overtime",           label: "Overtime Tracking",   icon: Clock,        desc: "Log and review OT hours",        hd: "bg-amber-600"  },
  { href: "/leaves",             label: "Leave Management",    icon: Plane,        desc: "Approve or reject requests",     hd: "bg-blue-700"   },
  { href: "/reports/daily",      label: "Daily Report",        icon: Calendar,     desc: "Today's attendance summary",     hd: "bg-green-700"  },
  { href: "/reports/monthly",    label: "Monthly Sheet",       icon: ClipboardList,desc: "Full month attendance grid",     hd: "bg-teal-700"   },
  { href: "/reports/absenteeism",label: "Absenteeism",         icon: AlertTriangle,desc: "Identify chronic absentees",     hd: "bg-red-700"    },
  { href: "/payroll",            label: "Payroll",             icon: FileText,     desc: "Consolidated wage register",     hd: "bg-purple-700" },
] as const;

export default function AdminDashboard() {
  const { isAdminEnabled } = useAdmin();
  const { data, isLoading } = useGetDashboardSummary();

  useEffect(() => {
    if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL;
  }, [isAdminEnabled]);

  if (!isAdminEnabled) return null;

  return (
    <div className="space-y-5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Header */}
      <div className="border-b-2 border-zinc-900 pb-3">
        <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Admin Panel</div>
        <div className="text-sm font-bold text-zinc-900">OVERTIME · LEAVES · REPORTS · PAYROLL</div>
      </div>

      {/* Quick stats */}
      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-3 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="bg-amber-600 px-4 py-1.5 border-r border-white/20">Pending Leaves</div>
          <div className="bg-purple-700 px-4 py-1.5 border-r border-white/20">OT Hrs / Month</div>
          <div className="bg-blue-700 px-4 py-1.5">Month Attendance</div>
        </div>
        <div className="grid grid-cols-3 bg-white">
          {isLoading || !data ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-4 border-r border-zinc-200 last:border-r-0">
                <div className="h-8 bg-zinc-100 animate-pulse" />
              </div>
            ))
          ) : (
            <>
              <div className="px-4 py-4 border-r border-zinc-200">
                <div className={`text-3xl font-bold tabular-nums ${data.pendingLeaveRequests > 0 ? "text-amber-700" : "text-zinc-400"}`}>
                  {data.pendingLeaveRequests}
                </div>
                {data.pendingLeaveRequests > 0 && (
                  <Link href="/leaves" className="text-[10px] text-amber-600 font-bold hover:underline">REVIEW →</Link>
                )}
              </div>
              <div className="px-4 py-4 border-r border-zinc-200">
                <div className="text-3xl font-bold tabular-nums text-purple-700">{data.overtimeHoursThisMonth}</div>
              </div>
              <div className="px-4 py-4">
                <div className={`text-3xl font-bold tabular-nums ${Number(data.monthAttendanceRate) >= 90 ? "text-green-700" : Number(data.monthAttendanceRate) >= 75 ? "text-amber-700" : "text-red-700"}`}>
                  {data.monthAttendanceRate}%
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Section links */}
      <div className="border-2 border-zinc-900">
        <div className="bg-zinc-900 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-zinc-400 uppercase">
          Admin Sections
        </div>
        {SECTIONS.map((s, i) => (
          <Link key={s.href} href={s.href}>
            <div className={`flex items-center border-t border-zinc-200 hover:bg-amber-50 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
              {/* Colored icon column */}
              <div className={`${s.hd} flex items-center justify-center w-12 self-stretch shrink-0 border-r border-zinc-200`}>
                <s.icon className="h-4 w-4 text-white" />
              </div>
              <div className="px-4 py-3 flex-1 min-w-0">
                <div className="text-xs font-bold text-zinc-900">{s.label}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{s.desc}</div>
              </div>
              <div className="px-4">
                <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
