import { useEffect, useState } from "react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ZoneSummary() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/zone-summary?month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [month]);

  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy").toUpperCase();

  const totals = data?.zones?.reduce(
    (acc: any, z: any) => ({
      headcount: acc.headcount + z.headcount,
      totalWage: acc.totalWage + z.totalWage,
      presentDays: acc.presentDays + z.presentDays,
      absentDays: acc.absentDays + z.absentDays,
      lateDays: acc.lateDays + z.lateDays,
      otHours: acc.otHours + z.otHours,
    }),
    { headcount: 0, totalWage: 0, presentDays: 0, absentDays: 0, lateDays: 0, otHours: 0 }
  ) ?? null;

  return (
    <div className="space-y-5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Zone Summary Dashboard</div>
          <div className="text-sm font-bold text-zinc-900">
            {data ? `${data.workingDays} WORKING DAYS · ${data.zones?.length} ZONES` : monthLabel}
          </div>
        </div>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
      </div>

      {/* Summary totals */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-2 border-zinc-900 divide-x-2 divide-zinc-900">
          {[
            { label: "Total headcount", value: totals.headcount, color: "text-zinc-900" },
            { label: "Total wage bill", value: `₹${inr(totals.totalWage)}`, color: "text-blue-700" },
            { label: "Present days", value: totals.presentDays.toFixed(0), color: "text-green-700" },
            { label: "Absent days", value: totals.absentDays.toFixed(0), color: "text-red-700" },
            { label: "Late arrivals", value: totals.lateDays, color: "text-orange-600" },
            { label: "OT hours", value: totals.otHours.toFixed(1), color: "text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="px-4 py-4 bg-white">
              <div className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase mb-1">{s.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Zone table */}
      <div className="border-2 border-zinc-900">
        <div className="bg-zinc-900 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-zinc-400 uppercase">Zone breakdown · {monthLabel}</div>
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] bg-zinc-800 border-t border-zinc-700 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-4 py-2 border-r border-zinc-700">Zone</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Headcount</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Wage bill</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Present</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Absent</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Late</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">OT hrs</div>
          <div className="px-3 py-2 text-right">Attendance %</div>
        </div>

        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 border-t border-zinc-200 animate-pulse bg-zinc-50" />
          ))
        ) : !data?.zones?.length ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No data for this month.</div>
        ) : (data.zones as any[]).map((z, ri) => {
          const rate = z.attendanceRate;
          const rateColor = rate >= 90 ? "text-green-700 bg-green-50" : rate >= 75 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
          return (
            <div key={z.departmentId} className={`grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/40"}`}>
              <div className="px-4 py-3 border-r border-zinc-200">
                <div className="text-xs font-bold text-zinc-900">{z.departmentName}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  <div className="w-full bg-zinc-200 h-1 mt-1">
                    <div className={`h-1 ${rate >= 90 ? "bg-green-500" : rate >= 75 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${rate}%` }} />
                  </div>
                </div>
              </div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs font-bold tabular-nums text-right text-zinc-900">{z.headcount}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs tabular-nums text-right text-blue-700">₹{inr(z.totalWage)}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs font-bold tabular-nums text-right text-green-700">{z.presentDays}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs font-bold tabular-nums text-right text-red-700">{z.absentDays}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs tabular-nums text-right text-orange-600">{z.lateDays}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs tabular-nums text-right text-amber-700">{z.otHours.toFixed(1)}</div>
              <div className={`px-3 py-3 text-xs font-bold tabular-nums text-right ${rateColor}`}>{rate}%</div>
            </div>
          );
        })}

        {/* Totals row */}
        {totals && !loading && (
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] border-t-2 border-zinc-900 bg-zinc-100">
            <div className="px-4 py-3 border-r border-zinc-300 text-[10px] font-bold tracking-wider text-zinc-600 uppercase">Total</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right">{totals.headcount}</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right text-blue-700">₹{inr(totals.totalWage)}</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right text-green-700">{totals.presentDays.toFixed(0)}</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right text-red-700">{totals.absentDays.toFixed(0)}</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right text-orange-600">{totals.lateDays}</div>
            <div className="px-3 py-3 border-r border-zinc-300 text-xs font-bold tabular-nums text-right text-amber-700">{totals.otHours.toFixed(1)}</div>
            <div className="px-3 py-3 text-xs font-bold tabular-nums text-right">
              {totals.headcount > 0 && data?.workingDays
                ? Math.round((totals.presentDays / (totals.headcount * data.workingDays)) * 1000) / 10 + "%"
                : "—"}
            </div>
          </div>
        )}
      </div>

      {/* Late arrivals detail */}
      {data?.zones?.some((z: any) => z.lateDays > 0) && (
        <div className="border-2 border-orange-400">
          <div className="bg-orange-400 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-white uppercase">
            Late arrival summary — employees with check-in after 09:00
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-orange-200 bg-white">
            {(data.zones as any[]).filter((z: any) => z.lateDays > 0).map((z: any) => (
              <div key={z.departmentId} className="px-4 py-3">
                <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">{z.departmentName}</div>
                <div className="text-xl font-bold text-orange-800 tabular-nums">{z.lateDays}</div>
                <div className="text-[10px] text-orange-500">late arrivals this month</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
