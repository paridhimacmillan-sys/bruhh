import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListDepartments, useCreateDepartment, useDeleteDepartment, getListDepartmentsQueryKey } from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function Departments() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListDepartments();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", displayOrder: "" });

  const createMut = useCreateDepartment({
    mutation: {
      onSuccess: () => { toast({ title: "Zone added" }); qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); setOpen(false); setForm({ name: "", code: "", displayOrder: "" }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteDepartment({
    mutation: {
      onSuccess: () => { toast({ title: "Zone removed" }); qc.invalidateQueries({ queryKey: getListDepartmentsQueryKey() }); },
      onError: () => toast({ title: "Cannot delete", description: "Zone may have employees", variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Zones / Departments</div>
          <div className="text-sm font-bold text-zinc-900">{data?.length ?? 0} ZONES IN FACTORY</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 px-4 bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> ADD ZONE
            </button>
          </DialogTrigger>
          <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <DialogHeader><DialogTitle className="text-sm font-bold tracking-wider">NEW ZONE</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (form.name) createMut.mutate({ data: { name: form.name, code: form.code || null, displayOrder: form.displayOrder ? Number(form.displayOrder) : 0 } }); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] tracking-wider uppercase">Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ZONE 8" className="rounded-none border-zinc-400 font-mono text-sm" /></div>
                <div><Label className="text-[10px] tracking-wider uppercase">Display Order</Label><Input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} placeholder="8" className="rounded-none border-zinc-400 font-mono text-sm" /></div>
              </div>
              <div><Label className="text-[10px] tracking-wider uppercase">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pin Production" required className="rounded-none border-zinc-400 font-mono text-sm" /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none text-xs">Cancel</Button>
                <button type="submit" disabled={createMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50">{createMut.isPending ? "ADDING…" : "ADD ZONE"}</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] bg-zinc-900 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          <div className="px-4 py-2 border-r border-zinc-700">Zone Name</div>
          <div className="px-4 py-2 border-r border-zinc-700">Code</div>
          <div className="px-4 py-2 border-r border-zinc-700">Employees</div>
          <div className="px-4 py-2" />
        </div>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 border-b border-zinc-200 animate-pulse bg-zinc-50" />)
        ) : !data || data.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400 bg-white">No zones yet.</div>
        ) : data.map((d, ri) => (
          <div key={d.id} className={`grid grid-cols-[1fr_1fr_1fr_auto] items-center border-b border-zinc-200 last:border-b-0 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
            <div className="px-4 py-3 border-r border-zinc-200 text-sm font-bold text-zinc-900">{d.name}</div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600 font-mono">{d.code ?? "—"}</div>
            <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600 tabular-nums">{d.employeeCount} employees</div>
            <div className="px-3 py-3">
              <button onClick={() => { if (confirm(`Delete ${d.name}?`)) deleteMut.mutate({ departmentId: d.id }); }} className="h-7 w-7 flex items-center justify-center hover:bg-red-50 text-zinc-400 hover:text-red-700 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
