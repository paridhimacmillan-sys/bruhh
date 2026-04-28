import { useState } from "react";
import { useGetForm12Report, getGetForm12ReportQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Printer } from "lucide-react";

export default function Form12() {
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const params = { month };
  const { data, isLoading } = useGetForm12Report(params, {
    query: { queryKey: getGetForm12ReportQueryKey(params) },
  });

  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy").toUpperCase();

  const totals = data ? {
    daysWorked:    data.employees.reduce((s, r) => s + r.daysWorked, 0),
    sundaysWorked: data.employees.reduce((s, r) => s + r.sundaysWorked, 0),
    holidaysWorked:data.employees.reduce((s, r) => s + r.holidaysWorked, 0),
    totalDays:     data.employees.reduce((s, r) => s + r.totalDays, 0),
  } : null;

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3 print:hidden">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Statutory Register</div>
          <div className="text-sm font-bold text-zinc-900">FORM 12 — RULE 78 · FACTORIES ACT</div>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
          <button onClick={() => window.print()} className="flex items-center gap-1.5 h-8 px-4 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
            <Printer className="h-3.5 w-3.5" /> PRINT
          </button>
        </div>
      </div>

      {/* Statutory document */}
      <div className="border-2 border-zinc-900 bg-white">

        {/* Formal header */}
        <div className="border-b-2 border-zinc-900 px-8 py-6 text-center">
          <div className="text-[10px] font-bold tracking-[0.3em] text-zinc-500 uppercase mb-2">Form 12 (See Rule 78)</div>
          <div className="text-2xl font-bold tracking-[0.1em] uppercase text-zinc-900 mb-1">Register of Wages</div>
          <div className="text-base font-bold text-zinc-800 mb-1">{data?.factoryName ?? "PREMIER PIN INDUSTRIES"}</div>
          <div className="text-sm text-zinc-600">For the month of <span className="font-bold text-zinc-900">{monthLabel}</span></div>
        </div>

        {/* Month metadata strip */}
        {data && (
          <div className="grid grid-cols-4 border-b-2 border-zinc-900">
            {[
              { label: "Total Calendar Days", value: data.totalDays, hd: "bg-zinc-700" },
              { label: "Working Days",          value: data.workingDays, hd: "bg-green-700" },
              { label: "Sundays",               value: data.sundays, hd: "bg-red-700" },
              { label: "Holidays",              value: data.holidays, hd: "bg-blue-700" },
            ].map((s) => (
              <div key={s.label} className="border-r border-zinc-300 last:border-r-0">
                <div className={`${s.hd} text-white text-[9px] font-bold tracking-[0.2em] uppercase px-4 py-1.5`}>{s.label}</div>
                <div className="px-4 py-3 text-2xl font-bold tabular-nums text-zinc-900">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-zinc-400">Loading…</div>
        ) : !data || data.employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">No data for this month.</div>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
              <div className="px-3 py-2 border-r border-zinc-700 text-center w-10">S.NO</div>
              <div className="px-4 py-2 border-r border-zinc-700">Emp Code</div>
              <div className="px-4 py-2 border-r border-zinc-700">Name of Worker</div>
              <div className="px-4 py-2 border-r border-zinc-700 text-right">Days Worked</div>
              <div className="px-4 py-2 border-r border-zinc-700 text-right">Sundays Worked</div>
              <div className="px-4 py-2 border-r border-zinc-700 text-right">Holidays Worked</div>
              <div className="px-4 py-2 text-right">Total Days</div>
            </div>

            {data.employees.map((r, ri) => (
              <div
                key={r.employeeId}
                className={`grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr] border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}`}
              >
                <div className="px-3 py-2.5 border-r border-zinc-200 text-center text-xs text-zinc-500 tabular-nums w-10">{r.serial}</div>
                <div className="px-4 py-2.5 border-r border-zinc-200 text-xs font-bold text-zinc-700 font-mono">{r.employeeCode}</div>
                <div className="px-4 py-2.5 border-r border-zinc-200 text-xs font-bold text-zinc-900">{r.employeeName}</div>
                <div className="px-4 py-2.5 border-r border-zinc-200 text-xs tabular-nums text-right font-mono">{r.daysWorked.toFixed(1)}</div>
                <div className="px-4 py-2.5 border-r border-zinc-200 text-xs tabular-nums text-right font-mono text-red-700">{r.sundaysWorked.toFixed(1)}</div>
                <div className="px-4 py-2.5 border-r border-zinc-200 text-xs tabular-nums text-right font-mono text-blue-700">{r.holidaysWorked.toFixed(1)}</div>
                <div className="px-4 py-2.5 text-xs tabular-nums text-right font-bold text-zinc-900 font-mono">{r.totalDays.toFixed(1)}</div>
              </div>
            ))}

            {/* Totals */}
            {totals && (
              <div className="grid grid-cols-[auto_1fr_2fr_1fr_1fr_1fr_1fr] border-t-2 border-zinc-900 bg-zinc-100">
                <div className="w-10 border-r border-zinc-300" />
                <div className="px-4 py-3 border-r border-zinc-300" />
                <div className="px-4 py-3 border-r border-zinc-300 text-[10px] font-bold tracking-wider text-zinc-600 uppercase flex items-center">Totals</div>
                <div className="px-4 py-3 border-r border-zinc-300 text-sm font-bold tabular-nums text-right font-mono">{totals.daysWorked.toFixed(1)}</div>
                <div className="px-4 py-3 border-r border-zinc-300 text-sm font-bold tabular-nums text-right font-mono text-red-700">{totals.sundaysWorked.toFixed(1)}</div>
                <div className="px-4 py-3 border-r border-zinc-300 text-sm font-bold tabular-nums text-right font-mono text-blue-700">{totals.holidaysWorked.toFixed(1)}</div>
                <div className="px-4 py-3 text-sm font-bold tabular-nums text-right font-mono text-zinc-900">{totals.totalDays.toFixed(1)}</div>
              </div>
            )}
          </>
        )}

        {/* Signature block */}
        <div className="border-t-2 border-zinc-900 px-8 py-8 grid grid-cols-3 gap-12">
          {["Prepared by", "Verified by", "Manager / Authorized Signatory"].map((label) => (
            <div key={label}>
              <div className="h-12" />
              <div className="border-t border-zinc-900 pt-1.5 text-[10px] font-bold tracking-wider text-zinc-600 uppercase">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
