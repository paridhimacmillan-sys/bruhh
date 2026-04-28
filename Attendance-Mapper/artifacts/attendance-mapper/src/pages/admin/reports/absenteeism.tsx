import { useEffect, useState } from "react";
import { useGetAbsenteeismReport, getGetAbsenteeismReportQueryKey } from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function AbsenteeismReport() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [threshold, setThreshold] = useState(3);
  const params = { month };
  const { data, isLoading } = useGetAbsenteeismReport(params, { query: { queryKey: getGetAbsenteeismReportQueryKey(params) } });

  const flagged = data?.employees.filter((e: any) => e.maxConsecutiveAbsent >= threshold) ?? [];

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Absenteeism Report</div>
          <div className="text-sm font-bold text-zinc-900">
            {data ? `${data.workingDays} WORKING DAYS · SORTED BY RATE` : format(new Date(`${month}-01`), "MMMM yyyy").toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">Streak alert ≥</label>
          <Input
            type="number" min={1} max={31} value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-16 h-8 text-xs font-mono rounded-none border-2 border-zinc-900 text-center"
          />
          <span className="text-[10px] text-zinc-400">days</span>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
        </div>
      </div>

      {/* Consecutive absence alert banner */}
      {flagged.length > 0 && (
        <div className="border-2 border-red-600 bg-red-50">
          <div className="bg-red-600 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-white uppercase flex items-center gap-2">
            ⚠ Consecutive absence alert — {flagged.length} {flagged.length === 1 ? "employee" : "employees"} absent {threshold}+ days in a row
          </div>
          <div className="divide-y divide-red-200">
            {flagged.map((e: any) => (
              <div key={e.employeeId} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-red-900">{e.employeeName}</span>
                  <span className="text-[10px] text-red-600 ml-2">{e.employeeCode} · {e.departmentName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-red-700 font-bold">{e.maxConsecutiveAbsent} CONSECUTIVE DAYS</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 ${e.absenteeismRate >= 50 ? "bg-red-600 text-white" : "bg-red-100 text-red-700"}`}>
                    {e.absenteeismRate}% absent rate
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-4 py-2 border-r border-zinc-700">Employee</div>
          <div className="px-4 py-2 border-r border-zinc-700">Zone</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Absent</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Late</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Max streak</div>
          <div className="px-4 py-2 text-right">Absent %</div>
        </div>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 border-t border-zinc-200 animate-pulse bg-zinc-50" />)
        ) : !data || data.employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No data for this month.</div>
        ) : (data.employees as any[]).map((e, ri) => {
          const streakAlert = e.maxConsecutiveAbsent >= threshold;
          return (
            <div key={e.employeeId} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"} ${streakAlert ? "border-l-2 border-l-red-500" : ""}`}>
              <div className="px-4 py-3 border-r border-zinc-200">
                <div className="text-xs font-bold text-zinc-900">{e.employeeName}</div>
                <div className="text-[10px] text-zinc-500">{e.employeeCode} · {e.designation}</div>
              </div>
              <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600">{e.departmentName}</div>
              <div className="px-4 py-3 border-r border-zinc-200 text-xs font-bold text-red-700 tabular-nums text-right">{e.absentDays}</div>
              <div className="px-4 py-3 border-r border-zinc-200 text-xs font-bold text-orange-600 tabular-nums text-right">{e.lateDays}</div>
              <div className={`px-4 py-3 border-r border-zinc-200 text-xs font-bold tabular-nums text-right ${streakAlert ? "text-red-700 bg-red-50" : "text-zinc-600"}`}>
                {e.maxConsecutiveAbsent}d {streakAlert ? "⚠" : ""}
              </div>
              <div className={`px-4 py-3 text-xs font-bold tabular-nums text-right ${e.absenteeismRate >= 25 ? "text-red-700 bg-red-50" : e.absenteeismRate >= 10 ? "text-amber-700 bg-amber-50" : "text-green-700"}`}>
                {e.absenteeismRate}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
