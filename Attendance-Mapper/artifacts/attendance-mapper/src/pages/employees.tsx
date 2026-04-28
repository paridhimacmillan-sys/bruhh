import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees, useCreateEmployee, useDeleteEmployee, useListDepartments,
  deleteEmployee, getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowRight, X } from "lucide-react";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function Employees() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeCode: "", name: "", departmentId: "", designation: "", monthlyWage: "", statsEligible: true, otEligible: true });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data: depts } = useListDepartments();
  const params = filter === "all" ? undefined : { departmentId: Number(filter) };
  const { data: employees, isLoading } = useListEmployees(params, { query: { queryKey: getListEmployeesQueryKey(params) } });

  const visibleIds = useMemo(() => new Set((employees ?? []).map((e) => e.id)), [employees]);
  const allSel = visibleIds.size > 0 && Array.from(visibleIds).every((id) => selected.has(id));
  const someSel = !allSel && Array.from(visibleIds).some((id) => selected.has(id));

  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allSel) { for (const id of visibleIds) n.delete(id); } else { for (const id of visibleIds) n.add(id); }
    return n;
  });
  const toggleOne = (id: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const createMut = useCreateEmployee({
    mutation: {
      onSuccess: () => { toast({ title: "Employee added" }); qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() }); setOpen(false); setForm({ employeeCode: "", name: "", departmentId: "", designation: "", monthlyWage: "", statsEligible: true, otEligible: true }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteEmployee({
    mutation: {
      onSuccess: () => { toast({ title: "Removed" }); qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeCode || !form.name || !form.departmentId || !form.designation) return;
    createMut.mutate({ data: { employeeCode: form.employeeCode, name: form.name, departmentId: Number(form.departmentId), designation: form.designation, monthlyWage: Number(form.monthlyWage) || 0, statsEligible: form.statsEligible, otEligible: form.otEligible } });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} employee(s)? This will also remove their attendance, OT, and leave records.`)) return;
    setBulkDeleting(true);
    const results = await Promise.allSettled(ids.map((id) => deleteEmployee(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false); setSelected(new Set());
    qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
    toast({ title: failed === 0 ? `Deleted ${ids.length - failed}` : `Deleted ${ids.length - failed}, failed ${failed}` });
  };

  return (
    <div className="space-y-4 pb-28" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Employees</div>
          <div className="text-sm font-bold text-zinc-900">{employees?.length ?? 0} EMPLOYEES REGISTERED</div>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-8 text-xs font-mono rounded-none border-2 border-zinc-900"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {depts?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.code ?? d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 px-4 bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> ADD EMPLOYEE
              </button>
            </DialogTrigger>
            <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              <DialogHeader><DialogTitle className="text-sm font-bold tracking-wider">NEW EMPLOYEE</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] tracking-wider uppercase">Employee ID</Label><Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Z001" required className="rounded-none border-zinc-400 font-mono text-sm" /></div>
                  <div><Label className="text-[10px] tracking-wider uppercase">Monthly Wage ₹</Label><Input type="number" value={form.monthlyWage} onChange={(e) => setForm({ ...form, monthlyWage: e.target.value })} placeholder="12000" className="rounded-none border-zinc-400 font-mono text-sm" /></div>
                </div>
                <div><Label className="text-[10px] tracking-wider uppercase">Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-none border-zinc-400 font-mono text-sm" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] tracking-wider uppercase">Zone</Label>
                    <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                      <SelectTrigger className="rounded-none border-zinc-400 font-mono text-sm"><SelectValue placeholder="Select zone" /></SelectTrigger>
                      <SelectContent>{depts?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.code ? `${d.code} — ${d.name}` : d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-[10px] tracking-wider uppercase">Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Operator" required className="rounded-none border-zinc-400 font-mono text-sm" /></div>
                </div>
                <div className="flex gap-6 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer"><Checkbox checked={form.statsEligible} onCheckedChange={(v) => setForm({ ...form, statsEligible: !!v })} />STATS (PF/ESI)</label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer"><Checkbox checked={form.otEligible} onCheckedChange={(v) => setForm({ ...form, otEligible: !!v })} />OT Eligible</label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none text-xs">Cancel</Button>
                  <button type="submit" disabled={createMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50 transition-colors">
                    {createMut.isPending ? "ADDING…" : "ADD EMPLOYEE"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border-2 border-zinc-900">
        {/* Col headers */}
        <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-3 py-2 border-r border-zinc-700">
            <Checkbox checked={allSel ? true : someSel ? "indeterminate" : false} onCheckedChange={toggleAll} className="border-zinc-400" />
          </div>
          <div className="px-3 py-2 border-r border-zinc-700">Employee</div>
          <div className="px-3 py-2 border-r border-zinc-700">Zone</div>
          <div className="px-3 py-2 border-r border-zinc-700">Designation</div>
          <div className="px-3 py-2 border-r border-zinc-700 text-right">Wage/Mo</div>
          <div className="px-3 py-2" />
        </div>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-zinc-200 animate-pulse bg-zinc-50" />
          ))
        ) : !employees || employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No employees yet. Add your first employee above.</div>
        ) : (
          employees.map((e, ri) => (
            <div key={e.id} className={`grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] items-center border-b border-zinc-200 last:border-b-0 ${selected.has(e.id) ? "bg-amber-50" : ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"} hover:bg-amber-50/60 transition-colors`}>
              <div className="px-3 py-3 border-r border-zinc-200">
                <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleOne(e.id)} />
              </div>
              <Link href={`/employees/${e.id}`} className="px-3 py-3 border-r border-zinc-200 min-w-0">
                <div className="text-xs font-bold text-zinc-900">{e.name}</div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                  <span className="font-mono">{e.employeeCode}</span>
                  {!e.statsEligible && <span className="bg-zinc-200 px-1 text-[9px] font-bold">NO STATS</span>}
                  {!e.otEligible && <span className="bg-zinc-200 px-1 text-[9px] font-bold">NO OT</span>}
                </div>
              </Link>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs text-zinc-600">{e.departmentName}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs text-zinc-600">{e.designation}</div>
              <div className="px-3 py-3 border-r border-zinc-200 text-xs font-bold text-zinc-900 text-right tabular-nums">{inr(e.monthlyWage)}</div>
              <div className="px-2 py-3 flex items-center gap-1">
                <Link href={`/employees/${e.id}`}>
                  <button className="h-7 w-7 flex items-center justify-center hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-900">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </Link>
                <button onClick={() => { if (confirm(`Delete ${e.name}?`)) deleteMut.mutate({ employeeId: e.id }); }} className="h-7 w-7 flex items-center justify-center hover:bg-red-50 text-zinc-400 hover:text-red-700 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bulk delete bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-red-700 bg-red-700">
            <div className="container mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-white font-mono">
                <span className="font-bold">{selected.size}</span>
                <span>selected</span>
                <button onClick={() => setSelected(new Set())} className="flex items-center gap-1 text-red-200 hover:text-white text-xs"><X className="h-3.5 w-3.5" />Clear</button>
              </div>
              <button onClick={bulkDelete} disabled={bulkDeleting} className="flex items-center gap-2 bg-white text-red-700 px-4 py-2 text-xs font-bold hover:bg-red-50 disabled:opacity-50 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />{bulkDeleting ? "DELETING…" : `DELETE ${selected.size}`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
