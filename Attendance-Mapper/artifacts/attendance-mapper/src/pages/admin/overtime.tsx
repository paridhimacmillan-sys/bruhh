import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOvertime, useCreateOvertime, useDeleteOvertime, useListEmployees, getListOvertimeQueryKey,
} from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function Overtime() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", date: format(new Date(), "yyyy-MM-dd"), hours: "", reason: "" });

  const params = useMemo(() => { const p: any = { month }; if (empFilter !== "all") p.employeeId = Number(empFilter); return p; }, [month, empFilter]);
  const { data, isLoading } = useListOvertime(params, { query: { queryKey: getListOvertimeQueryKey(params) } });
  const { data: employees } = useListEmployees();
  const total = useMemo(() => data?.reduce((s, e) => s + Number(e.hours), 0) ?? 0, [data]);

  const createMut = useCreateOvertime({
    mutation: {
      onSuccess: () => { toast({ title: "Overtime logged" }); qc.invalidateQueries({ queryKey: getListOvertimeQueryKey() }); setOpen(false); setForm({ employeeId: "", date: format(new Date(), "yyyy-MM-dd"), hours: "", reason: "" }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteOvertime({
    mutation: {
      onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: getListOvertimeQueryKey() }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Overtime Tracking</div>
          <div className="text-sm font-bold text-zinc-900">
            TOTAL: <span className="text-amber-600">{total.toFixed(1)} HRS</span> THIS PERIOD
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
          <Select value={empFilter} onValueChange={setEmpFilter}>
            <SelectTrigger className="w-44 h-8 text-xs font-mono rounded-none border-2 border-zinc-900"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All employees</SelectItem>{employees?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 h-8 px-4 bg-amber-500 text-zinc-900 text-xs font-bold hover:bg-amber-400 transition-colors">
                <Plus className="h-3.5 w-3.5" /> LOG OT
              </button>
            </DialogTrigger>
            <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              <DialogHeader><DialogTitle className="text-sm font-bold tracking-wider">LOG OVERTIME</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!form.employeeId || !form.hours) return; createMut.mutate({ data: { employeeId: Number(form.employeeId), date: new Date(form.date) as any, hours: Number(form.hours), reason: form.reason || null } }); }} className="space-y-3">
                <div><Label className="text-[10px] tracking-wider uppercase">Employee</Label>
                  <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                    <SelectTrigger className="rounded-none font-mono text-sm border-zinc-400"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{employees?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.employeeCode})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-[10px] tracking-wider uppercase">Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="rounded-none font-mono border-zinc-400" /></div>
                  <div><Label className="text-[10px] tracking-wider uppercase">Hours</Label><Input type="number" step="0.5" min="0" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} required className="rounded-none font-mono border-zinc-400" /></div>
                </div>
                <div><Label className="text-[10px] tracking-wider uppercase">Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="rounded-none font-mono border-zinc-400" /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none text-xs">Cancel</Button>
                  <button type="submit" disabled={createMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50">{createMut.isPending ? "SAVING…" : "LOG OT"}</button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-4 py-2 border-r border-zinc-700">Date</div>
          <div className="px-4 py-2 border-r border-zinc-700">Employee</div>
          <div className="px-4 py-2 border-r border-zinc-700">Zone</div>
          <div className="px-4 py-2 border-r border-zinc-700 text-right">Hours</div>
          <div className="px-4 py-2" />
        </div>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 border-t border-zinc-200 animate-pulse bg-zinc-50" />)
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No overtime entries for this period.</div>
        ) : data.map((e, ri) => (
          <div key={e.id} className={`grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600 tabular-nums">{format(new Date(e.date), "dd MMM yyyy")}</div>
            <div className="px-4 py-3 border-r border-zinc-200">
              <div className="text-xs font-bold text-zinc-900">{e.employeeName}</div>
              <div className="text-[10px] text-zinc-500">{e.employeeCode}{e.reason && ` · ${e.reason}`}</div>
            </div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600">{e.departmentName}</div>
            <div className="px-4 py-3 border-r border-zinc-200 text-sm font-bold text-amber-700 tabular-nums text-right">{e.hours}h</div>
            <div className="px-3 py-3">
              <button onClick={() => deleteMut.mutate({ overtimeId: e.id })} className="h-7 w-7 flex items-center justify-center hover:bg-red-50 text-zinc-400 hover:text-red-700 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {data && data.length > 0 && (
          <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] border-t-2 border-zinc-900 bg-zinc-100">
            <div className="px-4 py-2 col-span-3 text-[10px] font-bold tracking-wider text-zinc-600 uppercase text-right border-r border-zinc-300">Total OT Hours</div>
            <div className="px-4 py-2 border-r border-zinc-300 text-sm font-bold text-amber-700 tabular-nums text-right">{total.toFixed(1)}h</div>
            <div />
          </div>
        )}
      </div>
    </div>
  );
}
