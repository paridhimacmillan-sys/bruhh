import { useEffect, useMemo, useState } from "react";
import {
  useListEmployees,
  useGetMonthlyReport,
  useListOvertime,
  getGetMonthlyReportQueryKey,
  getListOvertimeQueryKey,
  type AttendanceStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";

const STATUS_META: Record<AttendanceStatus, { label: string; code: string; numeric: number }> = {
  present:  { label: "Present",  code: "P",  numeric: 1   },
  late:     { label: "Late",     code: "L",  numeric: 1   },
  half_day: { label: "Half Day", code: "HD", numeric: 0.5 },
  absent:   { label: "Absent",   code: "A",  numeric: 0   },
  on_leave: { label: "Leave",    code: "LV", numeric: 1   },
};

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function NavMonth({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const d = new Date(`${month}-01T00:00:00`);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(format(subMonths(d, 1), "yyyy-MM"))}
        className="h-8 w-8 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-100 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Input
        type="month"
        value={month}
        onChange={(e) => onChange(e.target.value)}
        className="w-36 text-center font-mono text-sm h-8"
      />
      <button
        onClick={() => onChange(format(addMonths(d, 1), "yyyy-MM"))}
        className="h-8 w-8 flex items-center justify-center rounded border border-zinc-300 hover:bg-zinc-100 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AttendanceSheet() {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [employeeId, setEmployeeId] = useState<string>("");

  const { data: employees, isLoading: empLoading } = useListEmployees();

  useEffect(() => {
    if (!employeeId && employees && employees.length > 0) {
      setEmployeeId(String(employees[0].id));
    }
  }, [employees, employeeId]);

  const monthlyParams = { month };
  const { data: monthly, isLoading: monthlyLoading } = useGetMonthlyReport(monthlyParams, {
    query: { queryKey: getGetMonthlyReportQueryKey(monthlyParams) },
  });

  const otParams = useMemo(
    () => (employeeId ? { month, employeeId: Number(employeeId) } : { month }),
    [month, employeeId],
  );
  const { data: overtime } = useListOvertime(otParams, {
    query: { queryKey: getListOvertimeQueryKey(otParams), enabled: !!employeeId },
  });

  const employee = useMemo(
    () => employees?.find((e) => String(e.id) === employeeId),
    [employees, employeeId],
  );

  const row = useMemo(() => {
    if (!monthly || !employeeId) return null;
    return monthly.employees.find((e) => String(e.employeeId) === employeeId);
  }, [monthly, employeeId]);

  const otByDate = useMemo(() => {
    const m = new Map<string, number>();
    (overtime ?? []).forEach((o) => {
      const k = format(new Date(o.date), "yyyy-MM-dd");
      m.set(k, (m.get(k) ?? 0) + Number(o.hours));
    });
    return m;
  }, [overtime]);

  const totals = useMemo(() => {
    if (!row) return null;
    const counts: Record<AttendanceStatus, number> = { present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0 };
    row.dailyStatuses.forEach((d) => { counts[d.status] = (counts[d.status] ?? 0) + 1; });
    const totalOT = Array.from(otByDate.values()).reduce((a, b) => a + b, 0);
    return { counts, totalOT };
  }, [row, otByDate]);

  const [monthNum, year] = useMemo(() => {
    const d = new Date(`${month}-01T00:00:00`);
    return [d.getMonth() + 1, d.getFullYear()];
  }, [month]);

  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy").toUpperCase();

  const empIndex = useMemo(() => employees?.findIndex((e) => String(e.id) === employeeId) ?? -1, [employees, employeeId]);
  const prevEmp = () => { if (!employees || empIndex <= 0) return; setEmployeeId(String(employees[empIndex - 1].id)); };
  const nextEmp = () => { if (!employees || empIndex >= employees.length - 1) return; setEmployeeId(String(employees[empIndex + 1].id)); };

  return (
    <div className="space-y-0 font-mono -mx-6 -mt-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        .sheet-root { font-family: 'IBM Plex Mono', monospace; }
        .col-a { background: #e0f5f2; }
        .col-b { background: #ccede8; }
        .col-c { background: #fef9e6; }
        .col-d { background: #fef2cc; }
        .col-e { background: #e8f5e9; }
        .col-f { background: #e3f2fd; }
        .col-g { background: #f3e5f5; }
        .col-a-hd { background: #26a69a; color: white; }
        .col-b-hd { background: #00897b; color: white; }
        .col-c-hd { background: #f9a825; color: white; }
        .col-d-hd { background: #f57f17; color: white; }
        .col-e-hd { background: #388e3c; color: white; }
        .col-f-hd { background: #1565c0; color: white; }
        .col-g-hd { background: #6a1b9a; color: white; }
        .row-sun { background: #ffebee !important; }
        .row-sun .date-cell { background: #ef5350 !important; color: white !important; }
        .row-sun .day-cell { background: #ffcdd2 !important; color: #b71c1c !important; }
        .row-sun .col-a, .row-sun .col-b, .row-sun .col-c,
        .row-sun .col-d, .row-sun .col-e, .row-sun .col-f, .row-sun .col-g { background: #ffebee !important; }
        .data-row:not(.row-sun):hover > div { filter: brightness(0.95); }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="sheet-root bg-white border-b border-zinc-200">

        {/* Control bar */}
        <div className="no-print border-b border-zinc-200 bg-zinc-50 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevEmp} disabled={empIndex <= 0} className="h-8 w-8 flex items-center justify-center rounded border border-zinc-300 hover:bg-white disabled:opacity-30 transition-colors bg-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-72 h-8 text-xs bg-white font-mono">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {empLoading && <SelectItem value="loading" disabled>Loading…</SelectItem>}
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)} className="font-mono text-xs">
                    {e.employeeCode} — {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={nextEmp} disabled={!employees || empIndex >= employees.length - 1} className="h-8 w-8 flex items-center justify-center rounded border border-zinc-300 hover:bg-white disabled:opacity-30 transition-colors bg-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <NavMonth month={month} onChange={setMonth} />
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8 font-mono text-xs bg-white">
              <Printer className="h-3.5 w-3.5" /> Print Out
            </Button>
          </div>
        </div>

        {/* Sheet header */}
        <div className="border-b-2 border-zinc-400">
          {/* Title + employee + period */}
          <div className="flex items-stretch">
            <div className="px-5 py-3 bg-zinc-900 text-white flex items-center shrink-0">
              <div>
                <div className="text-[9px] font-bold tracking-[0.3em] text-zinc-400 uppercase">Attendance</div>
                <div className="text-sm font-bold tracking-wider">SHEET</div>
              </div>
            </div>
            <div className="flex-1 px-5 py-3 bg-zinc-100 border-r border-zinc-300 flex items-center gap-4 min-w-0">
              <div className="text-base font-bold text-zinc-900 tracking-wide shrink-0">
                {employee?.employeeCode ?? "——"}
              </div>
              <div className="h-5 w-px bg-zinc-400 shrink-0" />
              <div className="text-base font-semibold text-zinc-800 truncate">
                {employee?.name ?? "Select an employee"}
              </div>
              {employee && (
                <>
                  <div className="h-5 w-px bg-zinc-400 shrink-0" />
                  <div className="text-xs text-zinc-500 font-sans truncate">
                    {employee.designation} · {employee.departmentName}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-3 bg-zinc-100 flex items-center gap-3 shrink-0">
              <span className="text-4xl font-bold text-amber-500 tabular-nums leading-none">{String(monthNum).padStart(2, "0")}</span>
              <span className="text-4xl font-bold text-zinc-600 tabular-nums leading-none">{year}</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex text-[10px] font-bold tracking-wider select-none">
            <div className="w-14 shrink-0 bg-zinc-300 flex items-center justify-center py-1.5 text-zinc-700 border-r border-zinc-400">DATE</div>
            <div className="w-12 shrink-0 bg-zinc-200 flex items-center justify-center py-1.5 text-zinc-600 border-r border-zinc-300">DAY</div>
            <div className="flex-[2] col-a-hd flex items-center justify-center py-1.5 border-r border-white/20">A · IN 1</div>
            <div className="flex-[2] col-b-hd flex items-center justify-center py-1.5 border-r border-white/20">B · OUT 1</div>
            <div className="flex-[2] col-c-hd flex items-center justify-center py-1.5 border-r border-white/20">C · IN 2</div>
            <div className="flex-[2] col-d-hd flex items-center justify-center py-1.5 border-r border-white/20">D · OUT 2</div>
            <div className="flex-[2] col-e-hd flex items-center justify-center py-1.5 border-r border-white/20 text-center leading-tight">E · TOTAL<br/>WORKED</div>
            <div className="flex-[1.5] col-f-hd flex items-center justify-center py-1.5 border-r border-white/20">ROUND OFF</div>
            <div className="flex-[1.5] col-g-hd flex items-center justify-center py-1.5">NUMERIC</div>
          </div>
        </div>

        {/* Rows */}
        {monthlyLoading ? (
          <div className="py-12 text-center text-zinc-400 text-xs font-sans">Loading…</div>
        ) : !row ? (
          <div className="py-12 text-center text-zinc-400 text-xs font-sans">
            {employeeId ? `No data for ${monthLabel}.` : "Select an employee above."}
          </div>
        ) : (
          <>
            {row.dailyStatuses.map((d, i) => {
              const day = new Date(d.date);
              const dow = day.getUTCDay();
              const isSun = dow === 0;
              const meta = STATUS_META[d.status];
              const ot = otByDate.get(d.date) ?? 0;

              // Time placeholders based on status — real data would come from attendance records
              const hasTime = d.status === "present" || d.status === "late";
              const in1  = hasTime ? (d.status === "late" ? "08:30" : "08:00") : "00:00";
              const out1 = hasTime ? "13:00" : "00:00";
              const in2  = "00:00";
              const out2 = "00:00";
              const totalH = hasTime ? (d.status === "late" ? "04:30" : "05:00") : "00:00";
              const roundH = hasTime ? (d.status === "late" ? "04:00" : "05:00") : "00:00";
              const numVal = isSun ? 8 : ot > 0 ? meta.numeric * 8 + ot : meta.numeric * 8;

              return (
                <div
                  key={d.date}
                  className={`data-row flex items-stretch text-xs tabular-nums border-b border-zinc-200 ${isSun ? "row-sun" : ""}`}
                >
                  <div className={`date-cell w-14 shrink-0 flex items-center justify-center font-bold text-sm border-r border-zinc-300 py-1 ${isSun ? "bg-red-500 text-white" : i % 2 === 0 ? "bg-zinc-100 text-zinc-700" : "bg-zinc-50 text-zinc-700"}`}>
                    {format(day, "dd")}
                  </div>
                  <div className={`day-cell w-12 shrink-0 flex items-center justify-center font-semibold border-r border-zinc-200 py-1 ${isSun ? "text-red-700" : "text-zinc-500"}`}>
                    {DOW[dow]}
                  </div>
                  <div className="flex-[2] col-a flex items-center justify-center border-r border-zinc-200 py-1">{in1}</div>
                  <div className="flex-[2] col-b flex items-center justify-center border-r border-zinc-200 py-1">{out1}</div>
                  <div className="flex-[2] col-c flex items-center justify-center border-r border-zinc-200 py-1">{in2}</div>
                  <div className="flex-[2] col-d flex items-center justify-center border-r border-zinc-200 py-1">{out2}</div>
                  <div className="flex-[2] col-e flex items-center justify-center border-r border-zinc-200 py-1 font-semibold">{totalH}</div>
                  <div className="flex-[1.5] col-f flex items-center justify-center border-r border-zinc-200 py-1">{roundH}</div>
                  <div className={`flex-[1.5] col-g flex items-center justify-center py-1 font-bold ${
                    isSun ? "text-zinc-500" :
                    d.status === "absent" ? "text-red-700" :
                    ot > 0 ? "text-purple-700" :
                    d.status === "on_leave" ? "text-blue-700" :
                    d.status === "half_day" ? "text-amber-700" :
                    "text-green-800"
                  }`}>
                    {numVal === 0 ? "0" : numVal % 1 === 0 ? numVal.toString() : numVal.toFixed(1)}
                  </div>
                </div>
              );
            })}

            {/* Totals */}
            {totals && (
              <div className="border-t-2 border-zinc-500">
                <div className="flex items-stretch text-xs bg-zinc-50">
                  <div className="w-14 shrink-0 border-r border-zinc-300" />
                  <div className="w-12 shrink-0 border-r border-zinc-200 flex items-center justify-end pr-2 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-600">TOT.</div>
                  <div className="flex-[2] col-a border-r border-zinc-200 py-2 flex items-center justify-center text-zinc-400">—</div>
                  <div className="flex-[2] col-b border-r border-zinc-200 py-2 flex items-center justify-center text-zinc-400">—</div>
                  <div className="flex-[2] col-c border-r border-zinc-200 py-2 flex items-center justify-center text-zinc-400">—</div>
                  <div className="flex-[2] col-d border-r border-zinc-200 py-2 flex items-center justify-center text-zinc-400">—</div>
                  <div className="flex-[2] col-e border-r border-zinc-200 py-2 flex items-center justify-center font-bold text-green-800">
                    {((totals.counts.present + totals.counts.late + totals.counts.on_leave) * 5 + totals.counts.half_day * 2.5).toFixed(0)}h
                  </div>
                  <div className="flex-[1.5] col-f border-r border-zinc-200 py-2 flex items-center justify-center text-zinc-400">—</div>
                  <div className="flex-[1.5] col-g py-2 flex items-center justify-center font-bold text-purple-800 text-sm">
                    {((totals.counts.present + totals.counts.late + totals.counts.on_leave) * 8 + totals.counts.half_day * 4 + totals.totalOT).toFixed(0)}
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="border-t border-zinc-200 px-4 py-2 flex flex-wrap gap-5 text-[11px]">
                  {(Object.keys(STATUS_META) as AttendanceStatus[]).map((s) => {
                    const c = totals.counts[s];
                    if (!c) return null;
                    const meta = STATUS_META[s];
                    return (
                      <span key={s} className="flex items-center gap-1.5">
                        <span className={`font-bold ${
                          s === "present" ? "text-green-700" :
                          s === "absent" ? "text-red-700" :
                          s === "late" ? "text-orange-600" :
                          s === "half_day" ? "text-amber-700" : "text-blue-700"
                        }`}>{meta.code}</span>
                        <span className="font-semibold text-zinc-700">{c}</span>
                        <span className="text-zinc-400 font-sans">{meta.label}</span>
                      </span>
                    );
                  })}
                  <span className="ml-auto text-zinc-500 font-sans">
                    Attendance: <strong className="text-zinc-800">{row.attendanceRate}%</strong>
                  </span>
                  {totals.totalOT > 0 && (
                    <span className="text-purple-600 font-sans">
                      OT: <strong>{totals.totalOT.toFixed(1)}h</strong>
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
