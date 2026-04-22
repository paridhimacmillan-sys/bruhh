import { Link } from "wouter";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CalendarCheck, Clock, AlertCircle, TrendingUp, Building2, UserCheck, UserX } from "lucide-react";
import { format } from "date-fns";

const STAT_COLS = [
  { key: "totalEmployees",      label: "TOTAL EMP",     icon: Users,       hd: "bg-zinc-700",   val: "text-white"       },
  { key: "totalDepartments",    label: "ZONES",          icon: Building2,   hd: "bg-zinc-700",   val: "text-white"       },
  { key: "todayAttendanceRate", label: "TODAY RATE",     icon: TrendingUp,  hd: "bg-teal-700",   val: "text-teal-700", suffix: "%" },
  { key: "monthAttendanceRate", label: "MONTH RATE",     icon: TrendingUp,  hd: "bg-blue-700",   val: "text-blue-700", suffix: "%" },
  { key: "todayPresent",        label: "PRESENT",        icon: UserCheck,   hd: "bg-green-700",  val: "text-green-700"   },
  { key: "todayAbsent",         label: "ABSENT",         icon: UserX,       hd: "bg-red-700",    val: "text-red-700"     },
  { key: "todayOnLeave",        label: "ON LEAVE",       icon: AlertCircle, hd: "bg-blue-700",   val: "text-blue-700"    },
  { key: "overtimeHoursThisMonth", label: "OT HRS/MO",  icon: Clock,       hd: "bg-amber-600",  val: "text-amber-700"   },
] as const;

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();
  const today = format(new Date(), "EEEE, dd MMMM yyyy").toUpperCase();

  return (
    <div className="space-y-5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Header strip */}
      <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Dashboard</div>
          <div className="text-lg font-bold text-zinc-900 tracking-wide">{today}</div>
        </div>
        <Link href="/attendance">
          <Button className="gap-2 bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-mono rounded-none h-9 px-4">
            <CalendarCheck className="h-3.5 w-3.5" />
            MARK TODAY'S ATTENDANCE
          </Button>
        </Link>
      </div>

      {/* Stats grid — Excel column header style */}
      <div>
        {/* Column headers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border-2 border-zinc-900">
          {STAT_COLS.map((s) => (
            <div key={s.key} className={`${s.hd} px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] text-white uppercase border-r border-white/20 last:border-r-0 flex items-center gap-1.5`}>
              <s.icon className="h-3 w-3 shrink-0" />
              {s.label}
            </div>
          ))}
        </div>
        {/* Values row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 border-x-2 border-b-2 border-zinc-900">
          {isLoading || !data ? (
            STAT_COLS.map((s) => (
              <div key={s.key} className="px-3 py-4 border-r border-zinc-300 last:border-r-0">
                <Skeleton className="h-8 w-16" />
              </div>
            ))
          ) : (
            STAT_COLS.map((s) => (
              <div key={s.key} className="px-3 py-4 bg-white border-r border-zinc-200 last:border-r-0 hover:bg-zinc-50 transition-colors">
                <div className={`text-3xl font-bold tabular-nums ${s.val}`}>
                  {data[s.key as keyof typeof data]}{"suffix" in s ? s.suffix : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick actions */}
      {data && (
        <div className="border-2 border-zinc-900">
          <div className="bg-zinc-900 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-zinc-400 uppercase">
            Quick Actions
          </div>
          <div className="bg-white px-4 py-3 flex flex-wrap gap-3">
            <Link href="/attendance">
              <button className="flex items-center gap-2 px-4 py-2 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
                <CalendarCheck className="h-3.5 w-3.5" /> Mark Attendance
              </button>
            </Link>
            <Link href="/employees">
              <button className="flex items-center gap-2 px-4 py-2 border-2 border-zinc-300 text-xs font-bold hover:border-zinc-900 transition-colors">
                <Users className="h-3.5 w-3.5" /> View Employees
              </button>
            </Link>
            <Link href="/payroll">
              <button className="flex items-center gap-2 px-4 py-2 border-2 border-zinc-300 text-xs font-bold hover:border-zinc-900 transition-colors">
                <Clock className="h-3.5 w-3.5" /> Payroll
              </button>
            </Link>
            <Link href="/reports/monthly">
              <button className="flex items-center gap-2 px-4 py-2 border-2 border-zinc-300 text-xs font-bold hover:border-zinc-900 transition-colors">
                <TrendingUp className="h-3.5 w-3.5" /> Monthly Report
              </button>
            </Link>
          </div>
          {data.pendingLeaveRequests > 0 && (
            <div className="border-t border-zinc-200 bg-amber-50 px-4 py-2 text-xs flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-bold text-amber-800">{data.pendingLeaveRequests}</span>
              <span className="text-amber-700">pending leave {data.pendingLeaveRequests === 1 ? "request" : "requests"}</span>
              <Link href="/leaves" className="ml-auto text-amber-800 font-bold underline underline-offset-2 text-[10px] tracking-wider">REVIEW →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
