import { useEffect, useState } from "react";
import { useGetDailyReport, getGetDailyReportQueryKey } from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const STATS = [
  { key: "totalEmployees", label: "TOTAL", hd: "bg-zinc-700" },
  { key: "attendanceRate",  label: "RATE %", hd: "bg-blue-700", suffix: "%" },
  { key: "present",        label: "PRESENT", hd: "bg-green-700" },
  { key: "late",           label: "LATE",    hd: "bg-orange-600" },
  { key: "halfDay",        label: "HALF DAY",hd: "bg-amber-600" },
  { key: "absent",         label: "ABSENT",  hd: "bg-red-700" },
  { key: "onLeave",        label: "ON LEAVE",hd: "bg-blue-700" },
] as const;

export default function DailyReport() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const params = { date: new Date(date) as any };
  const { data, isLoading } = useGetDailyReport(params, { query: { queryKey: getGetDailyReportQueryKey(params) } });
  const dateLabel = format(new Date(date), "EEEE, dd MMMM yyyy").toUpperCase();

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Daily Attendance Summary</div>
          <div className="text-sm font-bold text-zinc-900">{dateLabel}</div>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
      </div>

      {/* Stats strip */}
      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-7 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          {STATS.map((s) => <div key={s.key} className={`${s.hd} px-3 py-1.5 border-r border-white/20 last:border-r-0`}>{s.label}</div>)}
        </div>
        <div className="grid grid-cols-7 bg-white">
          {isLoading || !data
            ? STATS.map((s) => <div key={s.key} className="px-3 py-4 border-r border-zinc-200 last:border-r-0"><div className="h-8 bg-zinc-100 animate-pulse rounded" /></div>)
            : STATS.map((s) => <div key={s.key} className="px-3 py-4 border-r border-zinc-200 last:border-r-0 text-2xl font-bold tabular-nums text-zinc-800">{(data as any)[s.key]}{"suffix" in s ? s.suffix : ""}</div>)
          }
        </div>
      </div>

      {/* By department */}
      {data && (
        <div className="border-2 border-zinc-900">
          <div className="bg-zinc-900 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-zinc-400 uppercase">By Zone / Department</div>
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-zinc-800 text-[9px] font-bold tracking-[0.15em] text-white uppercase border-t border-zinc-700">
            <div className="px-4 py-2 border-r border-zinc-700">Zone</div>
            <div className="px-4 py-2 border-r border-zinc-700 text-right">Total</div>
            <div className="px-4 py-2 border-r border-zinc-700 text-right">Present</div>
            <div className="px-4 py-2 border-r border-zinc-700 text-right">Absent</div>
            <div className="px-4 py-2 text-right">Rate</div>
          </div>
          {data.byDepartment.map((d, ri) => (
            <div key={d.departmentId} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
              <div className="px-4 py-3 border-r border-zinc-200 text-sm font-bold text-zinc-900">{d.departmentName}</div>
              <div className="px-4 py-3 border-r border-zinc-200 text-sm tabular-nums text-right">{d.total}</div>
              <div className="px-4 py-3 border-r border-zinc-200 text-sm font-bold tabular-nums text-right text-green-700">{d.present}</div>
              <div className="px-4 py-3 border-r border-zinc-200 text-sm font-bold tabular-nums text-right text-red-700">{d.absent}</div>
              <div className={`px-4 py-3 text-sm font-bold tabular-nums text-right ${d.attendanceRate >= 90 ? "text-green-700" : d.attendanceRate >= 75 ? "text-amber-700" : "text-red-700"}`}>
                {d.attendanceRate}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
