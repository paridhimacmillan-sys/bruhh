import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetPayroll, useUpdatePayrollLine, getGetPayrollQueryKey, type PayrollEmployeeRow } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Printer, FileSpreadsheet, Pencil } from "lucide-react";

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => { const s = String(c ?? ""); return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = filename; a.click();
}

const COL_GROUPS = [
  { label: "EMPLOYEE", cols: ["S", "CODE", "NAME / ZONE"], hd: "bg-zinc-700" },
  { label: "ATTENDANCE", cols: ["WAGE", "DAYS", "OT h"], hd: "bg-blue-700" },
  { label: "EARNINGS", cols: ["BASIC ₹", "OT ₹", "TOTAL ₹"], hd: "bg-green-700" },
  { label: "DEDUCTIONS", cols: ["ADV BK", "ADV CS", "HRA+EL", "PF", "ESI", "TOTAL DED"], hd: "bg-red-700" },
  { label: "NET", cols: ["FINAL ₹"], hd: "bg-purple-700" },
  { label: "", cols: [""], hd: "bg-zinc-700" },
];

export default function Payroll() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const params = { month };
  const { data, isLoading } = useGetPayroll(params, { query: { queryKey: getGetPayrollQueryKey(params) } });

  const [editing, setEditing] = useState<PayrollEmployeeRow | null>(null);
  const [editForm, setEditForm] = useState({ openingAdvance: "", advanceBank: "", advanceCash: "", hraElec: "", closingAdvance: "" });

  const updateMut = useUpdatePayrollLine({
    mutation: {
      onSuccess: () => { toast({ title: "Payroll updated" }); qc.invalidateQueries({ queryKey: getGetPayrollQueryKey() }); setEditing(null); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  const openEdit = (row: PayrollEmployeeRow) => {
    setEditing(row);
    setEditForm({ openingAdvance: String(row.openingAdvance), advanceBank: String(row.advanceBank), advanceCash: String(row.advanceCash), hraElec: String(row.hraElec), closingAdvance: String(row.closingAdvance) });
  };
  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault(); if (!editing) return;
    updateMut.mutate({ employeeId: editing.employeeId, data: { month, openingAdvance: Number(editForm.openingAdvance) || 0, advanceBank: Number(editForm.advanceBank) || 0, advanceCash: Number(editForm.advanceCash) || 0, hraElec: Number(editForm.hraElec) || 0, closingAdvance: Number(editForm.closingAdvance) || 0, balanceCheque: 0 } });
  };

  const monthLabel = format(new Date(`${month}-01T00:00:00`), "MMMM yyyy").toUpperCase();
  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`payroll_${month}.csv`, [
      ["S.No","Code","Name","Zone","Wage","Days","OT Hrs","Basic","OT","Total","Adv Bk","Adv Cs","HRA+El","PF","ESI","Deduct","Final"],
      ...data.employees.map((r) => [r.serial,r.employeeCode,r.employeeName,r.departmentName,r.monthlyWage,r.daysPresent,r.otHours,r.basicPayable,r.otAmount,r.totalPayable,r.advanceBank,r.advanceCash,r.hraElec,r.pfAmount,r.esiAmount,r.deductions,r.finalPayable]),
    ]);
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3 print:hidden">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Payroll</div>
          <div className="text-sm font-bold text-zinc-900">PF 12% · ESI 0.75% · {monthLabel}</div>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
          <button onClick={exportCsv} className="flex items-center gap-1.5 h-8 px-3 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 h-8 px-3 border-2 border-zinc-900 text-xs font-bold hover:bg-zinc-900 hover:text-white transition-colors">
            <Printer className="h-3.5 w-3.5" /> PRINT
          </button>
        </div>
      </div>

      {/* Summary totals */}
      {data && (
        <div className="border-2 border-zinc-900 print:hidden">
          <div className="grid grid-cols-5 bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
            {["Basic Payable","OT Amount","Total Payable","Total Deductions","Net Final"].map((l, i) => (
              <div key={i} className="px-4 py-1.5 border-r border-zinc-700 last:border-r-0">{l}</div>
            ))}
          </div>
          <div className="grid grid-cols-5 bg-white">
            {[
              { v: data.totals.basicPayable, cls: "text-zinc-900" },
              { v: data.totals.otAmount, cls: "text-amber-700" },
              { v: data.totals.totalPayable, cls: "text-blue-700" },
              { v: data.totals.deductions, cls: "text-red-700" },
              { v: data.totals.finalPayable, cls: "text-green-700" },
            ].map((s, i) => (
              <div key={i} className="px-4 py-3 border-r border-zinc-200 last:border-r-0">
                <div className={`text-xl font-bold tabular-nums ${s.cls}`}>₹{inr(s.v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sheet header */}
      <div className="border-2 border-zinc-900">
        <div className="flex items-center bg-zinc-900 px-4 py-2 gap-4">
          <span className="text-white text-xs font-bold tracking-[0.15em] uppercase">Premier Pin Industries</span>
          <span className="text-zinc-400 text-xs">·</span>
          <span className="text-amber-400 text-xs font-bold tracking-wider">Payroll — {monthLabel}</span>
          {data && <span className="ml-auto text-zinc-400 text-[10px]">{data.workingDays} WORKING DAYS</span>}
        </div>

        {/* Group headers */}
        <div className="flex border-b border-zinc-900 text-[9px] font-bold tracking-wider text-white uppercase overflow-x-auto">
          <div className="bg-zinc-700 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "30px" }}>S</div>
          <div className="bg-zinc-700 px-2 py-1 border-r border-zinc-600" style={{ minWidth: "64px" }}>CODE</div>
          <div className="bg-zinc-700 px-2 py-1 border-r border-zinc-600 flex-1" style={{ minWidth: "150px" }}>NAME / ZONE</div>
          <div className="bg-blue-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "64px" }}>WAGE</div>
          <div className="bg-blue-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "48px" }}>DAYS</div>
          <div className="bg-blue-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "48px" }}>OT h</div>
          <div className="bg-green-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "72px" }}>BASIC</div>
          <div className="bg-green-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "64px" }}>OT ₹</div>
          <div className="bg-green-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "72px" }}>TOTAL</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "56px" }}>ADV BK</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "56px" }}>ADV CS</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "56px" }}>HRA+EL</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "56px" }}>PF</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "48px" }}>ESI</div>
          <div className="bg-red-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "64px" }}>DEDUCT</div>
          <div className="bg-purple-800 px-2 py-1 border-r border-zinc-600 text-center" style={{ minWidth: "72px" }}>FINAL ₹</div>
          <div className="bg-zinc-700 px-2 py-1 print:hidden" style={{ minWidth: "32px" }} />
        </div>

        {/* Rows */}
        <div className="overflow-x-auto">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 border-b border-zinc-200 animate-pulse bg-zinc-50" />)
          ) : !data || data.employees.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400 bg-white">No employees.</div>
          ) : data.employees.map((r, ri) => (
            <div key={r.employeeId} className={`flex items-center border-b border-zinc-200 text-xs tabular-nums ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"} hover:bg-amber-50/40 transition-colors`}>
              <div className="px-2 py-2 border-r border-zinc-200 text-center text-zinc-400" style={{ minWidth: "30px" }}>{r.serial}</div>
              <div className="px-2 py-2 border-r border-zinc-200 font-mono font-bold text-zinc-700" style={{ minWidth: "64px" }}>{r.employeeCode}</div>
              <div className="px-2 py-2 border-r border-zinc-200 flex-1" style={{ minWidth: "150px" }}>
                <div className="font-bold text-zinc-900 truncate">{r.employeeName}{!r.statsEligible && <span className="ml-1 bg-zinc-200 text-[9px] px-1 font-bold">NO PF</span>}</div>
                <div className="text-[10px] text-zinc-500">{r.departmentName}</div>
              </div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-zinc-600" style={{ minWidth: "64px" }}>{inr(r.monthlyWage)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right" style={{ minWidth: "48px" }}>{r.daysPresent.toFixed(1)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-amber-700" style={{ minWidth: "48px" }}>{r.otHours.toFixed(1)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold bg-green-50/60" style={{ minWidth: "72px" }}>{inr(r.basicPayable)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-amber-700 bg-green-50/60" style={{ minWidth: "64px" }}>{r.otAmount ? inr(r.otAmount) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-blue-700 bg-green-50/60" style={{ minWidth: "72px" }}>{inr(r.totalPayable)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30" style={{ minWidth: "56px" }}>{r.advanceBank ? inr(r.advanceBank) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30" style={{ minWidth: "56px" }}>{r.advanceCash ? inr(r.advanceCash) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right text-red-600 bg-red-50/30" style={{ minWidth: "56px" }}>{r.hraElec ? inr(r.hraElec) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right bg-red-50/30" style={{ minWidth: "56px" }}>{r.pfAmount ? inr(r.pfAmount) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right bg-red-50/30" style={{ minWidth: "48px" }}>{r.esiAmount ? inr(r.esiAmount) : "—"}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-red-700 bg-red-50" style={{ minWidth: "64px" }}>{inr(r.deductions)}</div>
              <div className="px-2 py-2 border-r border-zinc-200 text-right font-bold text-green-800 bg-green-50" style={{ minWidth: "72px" }}>₹{inr(r.finalPayable)}</div>
              <div className="px-2 py-2 print:hidden flex items-center justify-center" style={{ minWidth: "32px" }}>
                <button onClick={() => openEdit(r)} className="h-6 w-6 flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {/* Totals */}
          {data && data.employees.length > 0 && (
            <div className="flex items-center border-t-2 border-zinc-900 bg-zinc-100 text-xs font-bold tabular-nums">
              <div className="px-2 py-2 border-r border-zinc-300 text-zinc-500 text-right" style={{ minWidth: "30px" }} />
              <div className="px-2 py-2 border-r border-zinc-300 text-[10px] tracking-wider text-zinc-600 uppercase" style={{ minWidth: "64px" }} />
              <div className="px-2 py-2 border-r border-zinc-300 flex-1 text-[10px] tracking-wider text-zinc-600 uppercase" style={{ minWidth: "150px" }}>TOTALS</div>
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "64px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "48px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "48px" }} />
              <div className="px-2 py-2 border-r border-zinc-300 text-right" style={{ minWidth: "72px" }}>{inr(data.totals.basicPayable)}</div>
              <div className="px-2 py-2 border-r border-zinc-300 text-right text-amber-700" style={{ minWidth: "64px" }}>{inr(data.totals.otAmount)}</div>
              <div className="px-2 py-2 border-r border-zinc-300 text-right text-blue-700" style={{ minWidth: "72px" }}>{inr(data.totals.totalPayable)}</div>
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "56px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "56px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "56px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "56px" }} />
              <div className="px-2 py-2 border-r border-zinc-300" style={{ minWidth: "48px" }} />
              <div className="px-2 py-2 border-r border-zinc-300 text-right text-red-700" style={{ minWidth: "64px" }}>{inr(data.totals.deductions)}</div>
              <div className="px-2 py-2 border-r border-zinc-300 text-right text-green-800" style={{ minWidth: "72px" }}>₹{inr(data.totals.finalPayable)}</div>
              <div className="print:hidden" style={{ minWidth: "32px" }} />
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <DialogHeader><DialogTitle className="text-sm font-bold tracking-wider">EDIT PAYROLL · {editing.employeeName}</DialogTitle></DialogHeader>
            <form onSubmit={submitEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] tracking-wider uppercase">Opening Advance</Label><Input type="number" step="0.01" value={editForm.openingAdvance} onChange={(e) => setEditForm({ ...editForm, openingAdvance: e.target.value })} className="rounded-none font-mono border-zinc-400" /></div>
                <div><Label className="text-[10px] tracking-wider uppercase">Closing Advance</Label><Input type="number" step="0.01" value={editForm.closingAdvance} onChange={(e) => setEditForm({ ...editForm, closingAdvance: e.target.value })} className="rounded-none font-mono border-zinc-400" /></div>
                <div><Label className="text-[10px] tracking-wider uppercase">Advance — Bank</Label><Input type="number" step="0.01" value={editForm.advanceBank} onChange={(e) => setEditForm({ ...editForm, advanceBank: e.target.value })} className="rounded-none font-mono border-zinc-400" /></div>
                <div><Label className="text-[10px] tracking-wider uppercase">Advance — Cash</Label><Input type="number" step="0.01" value={editForm.advanceCash} onChange={(e) => setEditForm({ ...editForm, advanceCash: e.target.value })} className="rounded-none font-mono border-zinc-400" /></div>
                <div className="col-span-2"><Label className="text-[10px] tracking-wider uppercase">HRA + Electricity</Label><Input type="number" step="0.01" value={editForm.hraElec} onChange={(e) => setEditForm({ ...editForm, hraElec: e.target.value })} className="rounded-none font-mono border-zinc-400" /></div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)} className="rounded-none text-xs">Cancel</Button>
                <button type="submit" disabled={updateMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50">{updateMut.isPending ? "SAVING…" : "SAVE"}</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <style>{`@media print { @page { size: A3 landscape; margin: 8mm; } body { background: white !important; } }`}</style>
    </div>
  );
}
