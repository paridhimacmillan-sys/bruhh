import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPayroll, useUpdatePayrollLine, getGetPayrollQueryKey, type PayrollEmployeeRow } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Printer, FileSpreadsheet, Pencil, AlertTriangle, CheckCircle } from "lucide-react";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PF_WAGE_LIMIT  = 15000; // PF  applies if monthly wage ≤ ₹15,000
const ESI_WAGE_LIMIT = 21000; // ESI applies if monthly wage ≤ ₹21,000

const pfEligible  = (wage: number) => wage <= PF_WAGE_LIMIT;
const esiEligible = (wage: number) => wage <= ESI_WAGE_LIMIT;

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => { const s = String(c ?? ""); return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename;
  a.click();
}

export default function Payroll() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [showEligibility, setShowEligibility] = useState(false);
  const params = { month };
  const { data, isLoading } = useGetPayroll(params, { query: { queryKey: getGetPayrollQueryKey(params) } });

  const [editing, setEditing] = useState<PayrollEmployeeRow | null>(null);
  const [editForm, setEditForm] = useState({
    openingAdvance: "", advanceBank: "", advanceCash: "", hraElec: "", closingAdvance: "",
  });

  const updateMut = useUpdatePayrollLine({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payroll updated" });
        qc.invalidateQueries({ queryKey: getGetPayrollQueryKey() });
        setEditing(null);
      },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  const openEdit = (row: PayrollEmployeeRow) => {
    setEditing(row);
    setEditForm({
      openingAdvance: String(row.openingAdvance),
      advanceBank:    String(row.advanceBank),
      advanceCash:    String(row.advanceCash),
      hraElec:        String(row.hraElec),
      closingAdvance: String(row.closingAdvance),
    });
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateMut.mutate({
      employeeId: editing.employeeId,
      data: {
        month,
        openingAdvance: Number(editForm.openingAdvance) || 0,
        advanceBank:    Number(editForm.advanceBank)    || 0,
        advanceCash:    Number(editForm.advanceCash)    || 0,
        hraElec:        Number(editForm.hraElec)        || 0,
        closingAdvance: Number(editForm.closingAdvance) || 0,
        balanceCheque:  0,
      },
    });
  };

  // PF / ESI mismatch detection
  const eligibilityStats = useMemo(() => {
    if (!data) return null;
    const pfMismatch  = data.employees.filter((r) => pfEligible(r.monthlyWage)  && !r.statsEligible);
    const pfOver      = data.employees.filter((r) => !pfEligible(r.monthlyWage) &&  r.pfAmount  > 0 && r.statsEligible);
    const esiOver     = data.employees.filter((r) => !esiEligible(r.monthlyWage) && r.esiAmount > 0);
    return { pfMismatch, pfOver, esiOver };
  }, [data]);

  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy").toUpperCase();

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`payroll_${month}.csv`, [
      ["S.No","Code","Name","Zone","Wage","Days","Att%","OT Hrs","Basic","OT","Total","Adv Bk","Adv Cs","HRA+El","PF","ESI","Deduct","Final","PF Eligible","ESI Eligible"],
      ...data.employees.map((r) => {
        const attPct = data.workingDays > 0 ? `${Math.round((r.daysPresent / data.workingDays) * 100)}%` : "—";
        return [
          r.serial, r.employeeCode, r.employeeName, r.departmentName,
          r.monthlyWage, r.daysPresent, attPct, r.otHours,
          r.basicPayable, r.otAmount, r.totalPayable,
          r.advanceBank, r.advanceCash, r.hraElec, r.pfAmount, r.esiAmount, r.deductions, r.finalPayable,
          pfEligible(r.monthlyWage)  ? "YES" : "NO",
          esiEligible(r.monthlyWage) ? "YES" : "NO",
        ];
      }),
    ]);
  };

  const mismatchCount = eligibilityStats
    ? eligibilityStats.pfMismatch.length + eligibilityStats.pfOver.length + eligibilityStats.esiOver.length
    : 0;

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3 print:hidden">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Payroll</div>
          <div className="text-sm font-bold text-zinc-900">
            PF 12% (≤₹{inr(PF_WAGE_LIMIT)}) · ESI 0.75% (≤₹{inr(ESI_WAGE_LIMIT)}) · {monthLabel}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900"
          />
          <button
            onClick={() => setShowEligibility(!showEligibility)}
            className={`flex items-center gap-1.5 h-8 px-3 border-2 text-xs font-bold transition-colors
              ${showEligibility ? "bg-amber-400 border-amber-400 text-zinc-900" : "border-amber-500 text-amber-700 hover:bg-amber-50"}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            PF/ESI CHECK {mismatchCount > 0 && <span className="ml-1 bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">{mismatchCount}</span>}
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 h-8 px-3 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 h-8 px-3 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
            <Printer className="h-3.5 w-3.5" /> PRINT
          </button>
        </div>
      </div>

      {/* ── PF / ESI Eligibility Panel ───────────────────────────────────── */}
      {showEligibility && data && eligibilityStats && (
        <div className="border-2 border-amber-500 print:hidden">
          <div className="bg-amber-500 px-4 py-2 text-[9px] font-bold tracking-[0.25em] text-white uppercase flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            PF / ESI auto-eligibility check · {monthLabel}
          </div>
          <div className="bg-amber-50 px-4 py-4 space-y-4">

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                {
                  label: `PF eligible (wage ≤₹${inr(PF_WAGE_LIMIT)})`,
                  value: data.employees.filter((r) => pfEligible(r.monthlyWage)).length,
                  color: "text-zinc-900",
                },
                {
                  label: `ESI eligible (wage ≤₹${inr(ESI_WAGE_LIMIT)})`,
                  value: data.employees.filter((r) => esiEligible(r.monthlyWage)).length,
                  color: "text-zinc-900",
                },
                {
                  label: "PF flag mismatches",
                  value: eligibilityStats.pfMismatch.length + eligibilityStats.pfOver.length,
                  color: (eligibilityStats.pfMismatch.length + eligibilityStats.pfOver.length) > 0 ? "text-red-700" : "text-green-700",
                },
                {
                  label: "ESI deducted over limit",
                  value: eligibilityStats.esiOver.length,
                  color: eligibilityStats.esiOver.length > 0 ? "text-red-700" : "text-green-700",
                },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-amber-200 px-4 py-3">
                  <div className="text-[9px] font-bold tracking-wider text-amber-600 uppercase mb-1">{s.label}</div>
                  <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Per-employee eligibility table */}
            <div className="border border-amber-200 overflow-x-auto">
              <div
                className="grid bg-amber-700 text-white text-[9px] font-bold tracking-wider uppercase"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}
              >
                {["Employee", "Monthly wage", "PF eligible", "PF deducted", "ESI eligible", "ESI deducted"].map((h) => (
                  <div key={h} className="px-3 py-2 border-r border-amber-600 last:border-r-0">{h}</div>
                ))}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {data.employees.map((r, ri) => {
                  const pf  = pfEligible(r.monthlyWage);
                  const esi = esiEligible(r.monthlyWage);
                  const pfWrong  = (pf && !r.statsEligible) || (!pf && r.pfAmount  > 0 && r.statsEligible);
                  const esiWrong = !esi && r.esiAmount > 0;
                  return (
                    <div
                      key={r.employeeId}
                      className={`grid border-b border-amber-100 text-xs tabular-nums
                        ${pfWrong || esiWrong ? "bg-red-50" : ri % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}
                      style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}
                    >
                      <div className="px-3 py-2 border-r border-amber-100">
                        <div className="font-bold text-zinc-900 flex items-center gap-1">
                          {r.employeeName}
                          {(pfWrong || esiWrong) && (
                            <span className="text-[8px] bg-red-600 text-white px-1 font-bold">MISMATCH</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500">{r.employeeCode} · {r.departmentName}</div>
                      </div>
                      <div className="px-3 py-2 border-r border-amber-100 text-right font-bold">₹{inr(r.monthlyWage)}</div>
                      <div className={`px-3 py-2 border-r border-amber-100 text-center font-bold ${pf ? "text-green-700" : "text-zinc-400"}`}>
                        {pf
                          ? <span className="flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" /> YES</span>
                          : "NO"}
                        {pfWrong && <div className="text-[8px] text-red-600 font-normal">⚠ flag mismatch</div>}
                      </div>
                      <div className="px-3 py-2 border-r border-amber-100 text-right">
                        {r.pfAmount ? `₹${inr(r.pfAmount)}` : "—"}
                      </div>
                      <div className={`px-3 py-2 border-r border-amber-100 text-center font-bold ${esi ? "text-green-700" : "text-zinc-400"}`}>
                        {esi
                          ? <span className="flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" /> YES</span>
                          : "NO"}
                        {esiWrong && <div className="text-[8px] text-red-600 font-normal">⚠ over limit</div>}
                      </div>
                      <div className="px-3 py-2 text-right">
                        {r.esiAmount ? `₹${inr(r.esiAmount)}` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary Totals ───────────────────────────────────────────────── */}
      {data && (
        <div className="border-2 border-zinc-900 print:hidden">
          <div className="grid grid-cols-5 bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
            {["Basic Payable", "OT Amount", "Total Payable", "Total Deductions", "Net Final"].map((l) => (
              <div key={l} className="px-4 py-1.5 border-r border-zinc-700 last:border-r-0">{l}</div>
            ))}
          </div>
          <div className="grid grid-cols-5 bg-white">
            {[
              { v: data.totals.basicPayable,  cls: "text-zinc-900"  },
              { v: data.totals.otAmount,       cls: "text-amber-700" },
              { v: data.totals.totalPayable,   cls: "text-blue-700"  },
              { v: data.totals.deductions,     cls: "text-red-700"   },
              { v: data.totals.finalPayable,   cls: "text-green-700" },
            ].map((s, i) => (
              <div key={i} className="px-4 py-3 border-r border-zinc-200 last:border-r-0">
                <div className={`text-xl font-bold tabular-nums ${s.cls}`}>₹{inr(s.v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Sheet ───────────────────────────────────────────────────── */}
      <div className="border-2 border-zinc-900">
        <div className="flex items-center bg-zinc-900 px-4 py-2 gap-4">
          <span className="text-white text-xs font-bold tracking-[0.15em] uppercase">Premier Pin Industries</span>
          <span className="text-zinc-400 text-xs">·</span>
          <span className="text-amber-400 text-xs font-bold tracking-wider">Payroll — {monthLabel}</span>
          {data && <span className="ml-auto text-zinc-400 text-[10px]">{data.workingDays} WORKING DAYS</span>}
        </div>

        {/* Column headers */}
        <div className="flex border-b border-zinc-900 text-[9px] font-bold tracking-wider text-white uppercase overflow-x-auto">
          {[
            { label: "S",        bg: "bg-zinc-700",   w: "30px"  },
            { label: "CODE",     bg: "bg-zinc-700",   w: "64px"  },
            { label: "NAME / ZONE", bg: "bg-zinc-700", w: "150px", flex: true },
            { label: "WAGE",     bg: "bg-blue-800",   w: "64px"  },
            { label: "DAYS",     bg: "bg-blue-800",   w: "48px"  },
            { label: "ATT %",    bg: "bg-blue-800",   w: "48px"  },
            { label: "OT h",     bg: "bg-blue-800",   w: "48px"  },
            { label: "BASIC",    bg: "bg-green-800",  w: "72px"  },
            { label: "OT ₹",     bg: "bg-green-800",  w: "64px"  },
            { label: "TOTAL",    bg: "bg-green-800",  w: "72px"  },
            { label: "ADV BK",   bg: "bg-red-800",    w: "56px"  },
            { label: "ADV CS",   bg: "bg-red-800",    w: "56px"  },
            { label: "HRA+EL",   bg: "bg-red-800",    w: "56px"  },
            { label: "PF",       bg: "bg-red-800",    w: "56px"  },
            { label: "ESI",      bg: "bg-red-800",    w: "48px"  },
            { label: "DEDUCT",   bg: "bg-red-800",    w: "64px"  },
            { label: "FINAL ₹",  bg: "bg-purple-800", w: "72px"  },
            { label: "",         bg: "bg-zinc-700",   w: "32px", print: true },
          ].map((col, i) => (
            <div
              key={i}
              className={`${col.bg} px-2 py-1 border-r border-zinc-600 text-center ${col.flex ? "flex-1" : ""} ${col.print ? "print:hidden" : ""}`}
              style={{ minWidth: col.w }}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* Data rows */}
        <div className="overflow-x-auto">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 border-b border-zinc-200 animate-pulse bg-zinc-50" />
            ))
          ) : !data || data.employees.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400 bg-white">No employees found for this month.</div>
          ) : data.employees.map((r, ri) => {
            const attPct   = data.workingDays > 0 ? Math.round((r.daysPresent / data.workingDays) * 100) : 0;
            const pf       = pfEligible(r.monthlyWage);
            const esi      = esiEligible(r.monthlyWage);
            const pfWrong  = (pf && !r.statsEligible) || (!pf && r.pfAmount  > 0 && r.statsEligible);
            const esiWrong = !esi && r.esiAmount > 0;

            return (
              <div
                key={r.employeeId}
                className={`flex items-center border-b border-zinc-200 text-xs tabular-nums hover:bg-amber-50/40 transition-colors
                  ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
              >
                <div className="px-2 py-2 border-r border-zinc-200 text-center text-zinc-400" style={{ minWidth: "30px" }}>{r.serial}</div>
                <div className="px-2 py-2 border-r border-zinc-200 font-mono font-bold text-zinc-700" style={{ minWidth: "64px" }}>{r.employeeCode}</div>
                <div className="px-2 py-2 border-r border-zinc-200 flex-1" style={{ minWidth: "150px" }}>
                  <div className="font-bold text-zinc-900 truncate flex items-center gap-1">
                    {r.employeeName}
                    {(pfWrong || esiWrong) && <span className="bg-red-500 text-white text-[8px] px-1 font-bold shrink-0">!</span>}
                    {!pf  && <span className="bg-zinc-200 text-zinc-500 text-[8px] px-1 font-bold shrink-0">NO PF</span>}
                    {!esi && <span className="bg-zinc-200 text-zinc-500 text-[8px] px-1 font-bold shrink-0">NO ESI</span>}
                  </div>
                  <div className="text-[10px] text-zinc-500">{r.departmentName}</div>
                </div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-zinc-600"               style={{ minWidth: "64px" }}>{inr(r.monthlyWage)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right"                             style={{ minWidth: "48px" }}>{r.daysPresent.toFixed(1)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-[11px]"       style={{ minWidth: "48px" }}>
                  <span className={attPct >= 90 ? "text-green-700" : attPct >= 75 ? "text-amber-700" : "text-red-600"}>
                    {attPct}%
                  </span>
                </div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-amber-700"              style={{ minWidth: "48px" }}>{r.otHours.toFixed(1)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold bg-green-50/60"    style={{ minWidth: "72px" }}>{inr(r.basicPayable)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-amber-700 bg-green-50/60" style={{ minWidth: "64px" }}>{r.otAmount ? inr(r.otAmount) : "—"}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-blue-700 bg-green-50/60" style={{ minWidth: "72px" }}>{inr(r.totalPayable)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30"  style={{ minWidth: "56px" }}>{r.advanceBank  ? inr(r.advanceBank)  : "—"}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30"  style={{ minWidth: "56px" }}>{r.advanceCash  ? inr(r.advanceCash)  : "—"}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30"  style={{ minWidth: "56px" }}>{r.hraElec      ? inr(r.hraElec)      : "—"}</div>
                <div
                  className={`px-2 py-2 border-r border-zinc-200 text-right bg-red-50/30 ${pfWrong ? "text-red-600 font-bold" : ""}`}
                  style={{ minWidth: "56px" }}
                >
                  {r.pfAmount ? inr(r.pfAmount) : "—"}{pfWrong && <span className="text-[8px] ml-0.5">⚠</span>}
                </div>
                <div
                  className={`px-2 py-2 border-r border-zinc-200 text-right bg-red-50/30 ${esiWrong ? "text-red-600 font-bold" : ""}`}
                  style={{ minWidth: "48px" }}
                >
                  {r.esiAmount ? inr(r.esiAmount) : "—"}{esiWrong && <span className="text-[8px] ml-0.5">⚠</span>}
                </div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-red-700 bg-red-50" style={{ minWidth: "64px" }}>{inr(r.deductions)}</div>
                <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-green-800 bg-green-50" style={{ minWidth: "72px" }}>₹{inr(r.finalPayable)}</div>
                <div className="px-2 py-2 print:hidden flex items-center justify-center" style={{ minWidth: "32px" }}>
                  <button onClick={() => openEdit(r)} className="h-6 w-6 flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors">
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          {data && data.employees.length > 0 && (
            <div className="flex items-center border-t-2 border-zinc-900 bg-zinc-100 text-xs font-bold tabular-nums">
              <div style={{ minWidth: "30px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "64px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "150px" }} className="px-2 py-2 border-r border-zinc-300 flex-1 text-[10px] tracking-wider text-zinc-600 uppercase">Totals — {data.employees.length} employees</div>
              <div style={{ minWidth: "64px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "48px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "48px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "48px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "72px"  }} className="px-2 py-2 border-r border-zinc-300 text-right">{inr(data.totals.basicPayable)}</div>
              <div style={{ minWidth: "64px"  }} className="px-2 py-2 border-r border-zinc-300 text-right text-amber-700">{inr(data.totals.otAmount)}</div>
              <div style={{ minWidth: "72px"  }} className="px-2 py-2 border-r border-zinc-300 text-right text-blue-700">{inr(data.totals.totalPayable)}</div>
              <div style={{ minWidth: "56px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "56px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "56px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "56px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "48px"  }} className="px-2 py-2 border-r border-zinc-300" />
              <div style={{ minWidth: "64px"  }} className="px-2 py-2 border-r border-zinc-300 text-right text-red-700">{inr(data.totals.deductions)}</div>
              <div style={{ minWidth: "72px"  }} className="px-2 py-2 border-r border-zinc-300 text-right text-green-800">₹{inr(data.totals.finalPayable)}</div>
              <div style={{ minWidth: "32px"  }} className="print:hidden" />
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold tracking-wider">EDIT PAYROLL · {editing.employeeName}</DialogTitle>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 font-bold ${pfEligible(editing.monthlyWage) ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-500"}`}>
                  PF: {pfEligible(editing.monthlyWage) ? `YES (wage ≤ ₹${inr(PF_WAGE_LIMIT)})` : `NO (wage > ₹${inr(PF_WAGE_LIMIT)})`}
                </span>
                <span className={`text-[10px] px-2 py-0.5 font-bold ${esiEligible(editing.monthlyWage) ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-500"}`}>
                  ESI: {esiEligible(editing.monthlyWage) ? `YES (wage ≤ ₹${inr(ESI_WAGE_LIMIT)})` : `NO (wage > ₹${inr(ESI_WAGE_LIMIT)})`}
                </span>
              </div>
            </DialogHeader>
            <form onSubmit={submitEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] tracking-wider uppercase">Opening Advance</Label>
                  <Input type="number" step="0.01" value={editForm.openingAdvance} onChange={(e) => setEditForm({ ...editForm, openingAdvance: e.target.value })} className="rounded-none font-mono border-zinc-400" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-wider uppercase">Closing Advance</Label>
                  <Input type="number" step="0.01" value={editForm.closingAdvance} onChange={(e) => setEditForm({ ...editForm, closingAdvance: e.target.value })} className="rounded-none font-mono border-zinc-400" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-wider uppercase">Advance — Bank</Label>
                  <Input type="number" step="0.01" value={editForm.advanceBank} onChange={(e) => setEditForm({ ...editForm, advanceBank: e.target.value })} className="rounded-none font-mono border-zinc-400" />
                </div>
                <div>
                  <Label className="text-[10px] tracking-wider uppercase">Advance — Cash</Label>
                  <Input type="number" step="0.01" value={editForm.advanceCash} onChange={(e) => setEditForm({ ...editForm, advanceCash: e.target.value })} className="rounded-none font-mono border-zinc-400" />
                </div>
                <div className="col-span-2">
                  <Label className="text-[10px] tracking-wider uppercase">HRA + Electricity</Label>
                  <Input type="number" step="0.01" value={editForm.hraElec} onChange={(e) => setEditForm({ ...editForm, hraElec: e.target.value })} className="rounded-none font-mono border-zinc-400" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-none text-xs">Cancel</Button>
                <button type="submit" disabled={updateMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50">
                  {updateMut.isPending ? "SAVING…" : "SAVE"}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <style>{`@media print { @page { size: A3 landscape; margin: 8mm; } body { background: white !important; } }`}</style>
    </div>
  );
}
