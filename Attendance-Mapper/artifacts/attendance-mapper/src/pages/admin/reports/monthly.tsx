import { useEffect, useMemo, useState } from "react";
import { useGetMonthlyReport, useListDepartments, getGetMonthlyReportQueryKey } from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const SC: Record<string, { ch: string; hd: string; bg: string; txt: string }> = {
  present:  { ch: "P",  hd: "bg-green-700",  bg: "bg-green-100",  txt: "text-green-800" },
  late:     { ch: "L",  hd: "bg-orange-600", bg: "bg-orange-100", txt: "text-orange-800" },
  half_day: { ch: "H",  hd: "bg-amber-600",  bg: "bg-amber-100",  txt: "text-amber-800" },
  absent:   { ch: "A",  hd: "bg-red-700",    bg: "bg-red-100",    txt: "text-red-800" },
  on_leave: { ch: "LV", hd: "bg-blue-700",   bg: "bg-blue-100",   txt: "text-blue-800" },
};

export default function MonthlyReport() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [dept, setDept] = useState<string>("all");
  const params = useMemo(() => { const p: any = { month }; if (dept !== "all") p.departmentId = Number(dept); return p; }, [month, dept]);
  const { data, isLoading } = useGetMonthlyReport(params, { query: { queryKey: getGetMonthlyReportQueryKey(params) } });
  const { data: depts } = useListDepartments();
  const days = data?.employees[0]?.dailyStatuses.map((d) => d.date) ?? [];

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Monthly Attendance Sheet</div>
          <div className="text-sm font-bold text-zinc-900">
            {data ? `${data.workingDays} WORKING DAYS · ${data.employees.length} EMPLOYEES` : format(new Date(`${month}-01`), "MMMM yyyy").toUpperCase()}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-44 h-8 text-xs font-mono rounded-none border-2 border-zinc-900"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All zones</SelectItem>{depts?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(SC).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`inline-flex h-5 w-7 items-center justify-center text-[10px] font-bold ${v.bg} ${v.txt}`}>{v.ch}</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{k.replace("_", " ")}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 bg-zinc-100 animate-pulse border-2 border-zinc-300" />
      ) : !data || data.employees.length === 0 ? (
        <div className="border-2 border-zinc-900 py-12 text-center text-xs text-zinc-400 bg-white">No data for this month.</div>
      ) : (
        <div className="border-2 border-zinc-900 overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: "max-content" }}>
            <thead>
              <tr>
                {/* Sticky employee header */}
                <th className="bg-zinc-900 text-white text-[9px] font-bold tracking-wider uppercase px-3 py-2 text-left border-r-2 border-zinc-700 sticky left-0 z-10" style={{ minWidth: "180px" }}>
                  EMPLOYEE
                </th>
                {/* Day headers */}
                {days.map((d) => {
                  const day = new Date(d);
                  const isSun = day.getUTCDay() === 0;
                  return (
                    <th key={d} className={`px-1 py-1 text-center font-bold border-r border-zinc-700/50 last:border-r-0 ${isSun ? "bg-red-700 text-white" : "bg-zinc-800 text-zinc-300"}`} style={{ minWidth: "28px" }}>
                      <div className="text-[8px] opacity-70">{["S","M","T","W","T","F","S"][day.getUTCDay()]}</div>
                      <div className="text-[10px]">{format(day, "d")}</div>
                    </th>
                  );
                })}
                <th className="bg-green-800 text-white text-[9px] font-bold px-2 py-2 text-center border-l-2 border-zinc-700">P</th>
                <th className="bg-red-800 text-white text-[9px] font-bold px-2 py-2 text-center">A</th>
                <th className="bg-blue-800 text-white text-[9px] font-bold px-2 py-2 text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e, ri) => (
                <tr key={e.employeeId} className={ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                  <td className="px-3 py-2 sticky left-0 bg-inherit border-r-2 border-zinc-300 z-10">
                    <div className="font-bold text-zinc-900 whitespace-nowrap">{e.employeeName}</div>
                    <div className="text-[9px] text-zinc-500">{e.employeeCode} · {e.departmentName}</div>
                  </td>
                  {e.dailyStatuses.map((d) => {
                    const day = new Date(d.date);
                    const isSun = day.getUTCDay() === 0;
                    const c = SC[d.status];
                    return (
                      <td key={d.date} className={`px-0.5 py-1 text-center border-r border-zinc-200 last:border-r-0 ${isSun ? "bg-red-50" : ""}`}>
                        <span className={`inline-flex h-5 items-center justify-center text-[9px] font-bold ${c?.bg ?? ""} ${c?.txt ?? ""}`} style={{ minWidth: "24px" }} title={`${d.date}: ${d.status}`}>
                          {isSun ? <span className="text-red-400">—</span> : c?.ch ?? "-"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-bold text-green-700 border-l-2 border-zinc-300 tabular-nums">{e.present}</td>
                  <td className="px-2 py-2 text-center font-bold text-red-700 tabular-nums">{e.absent}</td>
                  <td className={`px-2 py-2 text-center font-bold tabular-nums ${e.attendanceRate >= 90 ? "text-green-700" : e.attendanceRate >= 75 ? "text-amber-700" : "text-red-700"}`}>{e.attendanceRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
