import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeaves, useCreateLeave, useUpdateLeaveStatus, useDeleteLeave, useListEmployees,
  getListLeavesQueryKey, getGetDashboardSummaryQueryKey, type LeaveStatus, type LeaveType,
} from "@workspace/api-client-react";
import { useAdmin } from "@/contexts/admin-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";

const LEAVE_HDS: Record<string, string> = {
  CL: "bg-blue-700", SL: "bg-pink-700", EL: "bg-green-700", LOP: "bg-zinc-600",
};
const LEAVE_VALS: Record<string, string> = {
  CL: "text-blue-700 bg-blue-50", SL: "text-pink-700 bg-pink-50", EL: "text-green-700 bg-green-50", LOP: "text-zinc-700 bg-zinc-100",
};
const TABS: LeaveStatus[] = ["pending", "approved", "rejected"];
const TAB_HDS: Record<LeaveStatus, string> = { pending: "bg-amber-600", approved: "bg-green-700", rejected: "bg-red-700" };

function LeaveList({ status }: { status: LeaveStatus }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const params = { status };
  const { data, isLoading } = useListLeaves(params, { query: { queryKey: getListLeavesQueryKey(params) } });

  const updateMut = useUpdateLeaveStatus({
    mutation: {
      onSuccess: () => { toast({ title: "Updated" }); qc.invalidateQueries({ queryKey: getListLeavesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });
  const deleteMut = useDeleteLeave({
    mutation: {
      onSuccess: () => { toast({ title: "Removed" }); qc.invalidateQueries({ queryKey: getListLeavesQueryKey() }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="py-8 text-center text-xs text-zinc-400">Loading…</div>;
  if (!data || data.length === 0) return <div className="py-12 text-center text-xs text-zinc-400">No {status} leave requests.</div>;

  return (
    <>
      {/* Col headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] bg-zinc-800 text-[9px] font-bold tracking-[0.15em] text-white uppercase border-t border-zinc-700">
        <div className="px-4 py-2 border-r border-zinc-700">Employee</div>
        <div className="px-4 py-2 border-r border-zinc-700">Type</div>
        <div className="px-4 py-2 border-r border-zinc-700">Dates</div>
        <div className="px-4 py-2 border-r border-zinc-700">Days</div>
        <div className="px-4 py-2" />
      </div>
      {data.map((l, ri) => (
        <div key={l.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center border-t border-zinc-200 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"} hover:bg-amber-50/40 transition-colors`}>
          <div className="px-4 py-3 border-r border-zinc-200">
            <div className="text-xs font-bold text-zinc-900">{l.employeeName}</div>
            <div className="text-[10px] text-zinc-500">{l.employeeCode} · {l.departmentName}</div>
            {l.reason && <div className="text-[10px] text-zinc-400 italic mt-0.5">"{l.reason}"</div>}
          </div>
          <div className="px-4 py-3 border-r border-zinc-200">
            <span className={`text-xs font-bold px-2 py-0.5 ${LEAVE_VALS[l.leaveType] ?? "bg-zinc-100 text-zinc-700"}`}>{l.leaveType}</span>
          </div>
          <div className="px-4 py-3 border-r border-zinc-200 text-xs text-zinc-600 tabular-nums">
            {format(new Date(l.startDate), "dd MMM")} → {format(new Date(l.endDate), "dd MMM yy")}
          </div>
          <div className="px-4 py-3 border-r border-zinc-200 text-xs font-bold tabular-nums text-zinc-900">{l.days}d</div>
          <div className="px-3 py-3 flex items-center gap-1">
            {status === "pending" && (
              <>
                <button onClick={() => updateMut.mutate({ leaveId: l.id, data: { status: "approved" } })} className="h-7 px-2 bg-green-700 text-white text-[10px] font-bold hover:bg-green-600 transition-colors flex items-center gap-1">
                  <Check className="h-3 w-3" /> OK
                </button>
                <button onClick={() => updateMut.mutate({ leaveId: l.id, data: { status: "rejected" } })} className="h-7 px-2 bg-red-700 text-white text-[10px] font-bold hover:bg-red-600 transition-colors flex items-center gap-1">
                  <X className="h-3 w-3" /> REJ
                </button>
              </>
            )}
            <button onClick={() => { if (confirm("Delete this leave request?")) deleteMut.mutate({ leaveId: l.id }); }} className="h-7 w-7 flex items-center justify-center hover:bg-red-50 text-zinc-400 hover:text-red-700 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

export default function Leaves() {
  const { isAdminEnabled } = useAdmin();
  useEffect(() => { if (!isAdminEnabled) window.location.href = import.meta.env.BASE_URL; }, [isAdminEnabled]);
  if (!isAdminEnabled) return null;

  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<LeaveStatus>("pending");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", leaveType: "CL" as LeaveType, startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd"), reason: "" });
  const { data: employees } = useListEmployees();

  const createMut = useCreateLeave({
    mutation: {
      onSuccess: () => { toast({ title: "Leave request created" }); qc.invalidateQueries({ queryKey: getListLeavesQueryKey() }); setOpen(false); setForm({ employeeId: "", leaveType: "CL", startDate: format(new Date(), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd"), reason: "" }); },
      onError: (e: any) => toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-4" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Leave Management</div>
          <div className="text-sm font-bold text-zinc-900">CL · SL · EL · LOP</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 h-8 px-4 bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition-colors">
              <Plus className="h-3.5 w-3.5" /> NEW REQUEST
            </button>
          </DialogTrigger>
          <DialogContent style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <DialogHeader><DialogTitle className="text-sm font-bold tracking-wider">NEW LEAVE REQUEST</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!form.employeeId) return; createMut.mutate({ data: { employeeId: Number(form.employeeId), leaveType: form.leaveType, startDate: new Date(form.startDate) as any, endDate: new Date(form.endDate) as any, reason: form.reason || null } }); }} className="space-y-3">
              <div><Label className="text-[10px] tracking-wider uppercase">Employee</Label>
                <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                  <SelectTrigger className="rounded-none font-mono text-sm border-zinc-400"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees?.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.employeeCode})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-[10px] tracking-wider uppercase">Leave Type</Label>
                <Select value={form.leaveType} onValueChange={(v) => setForm({ ...form, leaveType: v as LeaveType })}>
                  <SelectTrigger className="rounded-none font-mono text-sm border-zinc-400"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CL">CL — Casual Leave</SelectItem>
                    <SelectItem value="SL">SL — Sick Leave</SelectItem>
                    <SelectItem value="EL">EL — Earned Leave</SelectItem>
                    <SelectItem value="LOP">LOP — Loss of Pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] tracking-wider uppercase">Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required className="rounded-none font-mono border-zinc-400" /></div>
                <div><Label className="text-[10px] tracking-wider uppercase">End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required className="rounded-none font-mono border-zinc-400" /></div>
              </div>
              <div><Label className="text-[10px] tracking-wider uppercase">Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="rounded-none font-mono border-zinc-400" /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none text-xs">Cancel</Button>
                <button type="submit" disabled={createMut.isPending} className="bg-zinc-900 text-white px-4 py-2 text-xs font-bold hover:bg-zinc-700 disabled:opacity-50">{createMut.isPending ? "SAVING…" : "CREATE"}</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tab strip */}
      <div className="border-2 border-zinc-900">
        <div className="flex border-b border-zinc-900">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-[10px] font-bold tracking-[0.2em] uppercase border-r last:border-r-0 border-zinc-900 transition-colors ${tab === t ? `${TAB_HDS[t]} text-white` : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
              {t}
            </button>
          ))}
        </div>
        <LeaveList status={tab} />
      </div>
    </div>
  );
}
