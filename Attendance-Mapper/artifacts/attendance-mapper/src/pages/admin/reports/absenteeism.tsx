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
  const params = { month };
  const { data, isLoading } = useGetAbsenteeismReport(params, { query: { queryKey: getGetAbsenteeismReportQueryKey(params) } });

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Absenteeism Report</div>
          <div className="text-sm font-bold text-zinc-900">
            {data ? `${data.workingDays} WORKING DAYS · SORTED BY RATE` : format(new Date(`${month}-01`), "MMMM yyyy").toUpperCase()}
          </div>
        </div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
      </div>

      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-4 py-2 border-r border-zinc-700">Employee</div>
          <div className="px-4 py-2 border-r border-zinc-700">Zone</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Absent Days</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Late Days</div>
          <div className="px-4 py-2 text-right">Absenteeism %</div>
        </div>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 border-t border-zinc-200 animate-pulse bg-zinc-50" />)
        ) : !data || data.employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No data for this month.</div>
        ) : data.employees.map((e, ri) => (
          <div key={e.employeeId} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
            <div className="px-4 py-3 border-r border-zinc-200">
              <div className="text-xs font-bold text-zinc-900">{e.employeeName}</div>
              <div className="text-[10px] text-zinc-500">{e.employeeCode} · {e.designation}</div>
            </div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600">{e.departmentName}</div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs font-bold text-red-700 tabular-nums text-right">{e.absentDays}</div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs font-bold text-orange-600 tabular-nums text-right">{e.lateDays}</div>
            <div className={`px-4 py-3 text-xs font-bold tabular-nums text-right ${e.absenteeismRate >= 25 ? "text-red-700 bg-red-50" : e.absenteeismRate >= 10 ? "text-amber-700 bg-amber-50" : "text-green-700"}`}>
              {e.absenteeismRate}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
