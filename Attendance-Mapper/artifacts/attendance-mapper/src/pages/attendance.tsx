import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDayAttendance, useSetDayAttendance, useListDepartments,
  getGetDayAttendanceQueryKey, getGetDashboardSummaryQueryKey,
  type AttendanceEntry, type AttendanceStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Save, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_OPTS: { value: AttendanceStatus; label: string; code: string; col: string; hd: string }[] = [
  { value: "present",  label: "Present",  code: "P",  col: "bg-green-50",  hd: "bg-green-700"  },
  { value: "late",     label: "Late",     code: "L",  col: "bg-orange-50", hd: "bg-orange-600" },
  { value: "half_day", label: "Half Day", code: "HD", col: "bg-amber-50",  hd: "bg-amber-600"  },
  { value: "absent",   label: "Absent",   code: "A",  col: "bg-red-50",    hd: "bg-red-700"    },
  { value: "on_leave", label: "Leave",    code: "LV", col: "bg-blue-50",   hd: "bg-blue-700"   },
];

type Draft = { status: AttendanceStatus; inTime1: string; outTime1: string; inTime2: string; outTime2: string; note: string };
const empty: Draft = { status: "absent", inTime1: "", outTime1: "", inTime2: "", outTime2: "", note: "" };

function toMin(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  return h >= 0 && h <= 23 && min >= 0 && min <= 59 ? h * 60 + min : null;
}
function calcHours(d: Draft) {
  let total = 0, any = false;
  const a = toMin(d.inTime1), b = toMin(d.outTime1);
  if (a !== null && b !== null && b > a) { total += b - a; any = true; }
  const c = toMin(d.inTime2), q = toMin(d.outTime2);
  if (c !== null && q !== null && q > c) { total += q - c; any = true; }
  return any ? Math.round((total / 60) * 100) / 100 : null;
}

function navDate(date: string, dir: 1 | -1) {
  const d = new Date(date); d.setDate(d.getDate() + dir);
  return format(d, "yyyy-MM-dd");
}

export default function Attendance() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const params = useMemo(() => {
    const p: any = { date };
    if (departmentId !== "all") p.departmentId = Number(departmentId);
    return p;
  }, [date, departmentId]);

  const { data: depts } = useListDepartments();
  const { data, isLoading } = useGetDayAttendance(params, { query: { queryKey: getGetDayAttendanceQueryKey(params) } });
  const [draft, setDraft] = useState<Map<number, Draft>>(new Map());

  useEffect(() => {
    if (data) {
      const m = new Map<number, Draft>();
      for (const e of data.entries) {
        m.set(e.employeeId, {
          status: e.status, inTime1: e.inTime1 ?? "", outTime1: e.outTime1 ?? "",
          inTime2: e.inTime2 ?? "", outTime2: e.outTime2 ?? "", note: e.note ?? "",
        });
      }
      setDraft(m);
    }
  }, [data]);

  const upd = (id: number, patch: Partial<Draft>) => setDraft((d) => { const n = new Map(d); n.set(id, { ...n.get(id) ?? empty, ...patch }); return n; });
  const setStatus = (id: number, status: AttendanceStatus) => upd(id, { status });

  const markAllPresent = () => {
    if (!data) return;
    setDraft((d) => {
      const n = new Map(d);
      for (const e of data.entries) {
        const cur = n.get(e.employeeId) ?? empty;
        n.set(e.employeeId, { ...cur, status: "present", inTime1: cur.inTime1 || "09:00", outTime1: cur.outTime1 || "13:00", inTime2: cur.inTime2 || "13:30", outTime2: cur.outTime2 || "17:30" });
      }
      return n;
    });
  };

  const dirtyCount = useMemo(() => {
    if (!data) return 0;
    return data.entries.filter((e) => {
      const cur = draft.get(e.employeeId);
      return cur && (cur.status !== e.status || (cur.inTime1 || "") !== (e.inTime1 ?? "") || (cur.outTime1 || "") !== (e.outTime1 ?? "") || (cur.inTime2 || "") !== (e.inTime2 ?? "") || (cur.outTime2 || "") !== (e.outTime2 ?? "") || (cur.note || "") !== (e.note ?? ""));
    }).length;
  }, [draft, data]);

  const setMut = useSetDayAttendance({
    mutation: {
      onSuccess: () => { toast({ title: "Attendance saved" }); qc.invalidateQueries({ queryKey: getGetDayAttendanceQueryKey(params) }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); },
      onError: (e: any) => toast({ title: "Save failed", description: String(e?.message ?? e), variant: "destructive" }),
    },
  });

  const save = () => {
    const entries = Array.from(draft.entries()).map(([employeeId, v]) => ({
      employeeId, status: v.status,
      inTime1: v.inTime1 || null, outTime1: v.outTime1 || null,
      inTime2: v.inTime2 || null, outTime2: v.outTime2 || null, note: v.note || null,
    }));
    setMut.mutate({ data: { date: new Date(date) as any, entries } });
  };

  const grouped = useMemo(() => {
    const m = new Map<string, AttendanceEntry[]>();
    if (data) for (const e of data.entries) { const arr = m.get(e.departmentName) ?? []; arr.push(e); m.set(e.departmentName, arr); }
    return Array.from(m.entries());
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, late: 0, half_day: 0, absent: 0, on_leave: 0 };
    if (data) for (const e of data.entries) { const s = draft.get(e.employeeId)?.status ?? e.status; c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [draft, data]);

  const dateLabel = format(new Date(date), "EEEE, dd MMMM yyyy").toUpperCase();

  return (
    <div className="space-y-4 pb-28" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase mb-1">Mark Attendance</div>
          <div className="text-sm font-bold text-zinc-900">{dateLabel}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date nav */}
          <button onClick={() => setDate(navDate(date, -1))} className="h-8 w-8 flex items-center justify-center border-2 border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40 h-8 text-xs font-mono rounded-none border-2 border-zinc-900" />
          <button onClick={() => setDate(navDate(date, 1))} className="h-8 w-8 flex items-center justify-center border-2 border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-44 h-8 text-xs font-mono rounded-none border-2 border-zinc-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {depts?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.code ?? d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={markAllPresent} className="h-8 px-3 text-xs font-bold border-2 border-zinc-300 hover:border-zinc-900 transition-colors flex items-center gap-1.5">
            ✓ ALL PRESENT
          </button>
        </div>
      </div>

      {/* Status summary strip */}
      {data && (
        <div className="border-2 border-zinc-900">
          <div className="grid grid-cols-5">
            {STATUS_OPTS.map((s) => (
              <div key={s.value} className={`${s.hd} px-3 py-1.5 text-[9px] font-bold tracking-[0.2em] text-white uppercase border-r border-white/20 last:border-r-0`}>
                {s.code} · {s.label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-5 bg-white">
            {STATUS_OPTS.map((s) => (
              <div key={s.value} className="px-3 py-3 border-r border-zinc-200 last:border-r-0 text-2xl font-bold tabular-nums text-zinc-800">
                {counts[s.value]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-px border-2 border-zinc-900">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-zinc-100 animate-pulse border-b border-zinc-200" />
          ))}
        </div>
      ) : grouped.map(([deptName, entries]) => (
        <div key={deptName} className="border-2 border-zinc-900">
          {/* Dept header */}
          <div className="bg-zinc-900 text-white px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase flex items-center justify-between">
            <span>{deptName}</span>
            <span className="text-zinc-400">{entries.length} EMPLOYEES</span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_repeat(5,auto)] bg-zinc-100 border-b border-zinc-300 text-[9px] font-bold tracking-[0.15em] text-zinc-600 uppercase">
            <div className="px-3 py-2 border-r border-zinc-300">EMPLOYEE</div>
            <div className="px-3 py-2 border-r border-zinc-300 text-center">HOURS</div>
            {STATUS_OPTS.map((s) => (
              <div key={s.value} className={`px-3 py-2 border-r border-zinc-300 last:border-r-0 text-center text-[9px] ${s.hd} text-white`}>
                {s.code}
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {entries.map((entry, ri) => {
            const cur = draft.get(entry.employeeId) ?? empty;
            const isExp = expanded.has(entry.employeeId);
            const computed = calcHours(cur);
            const showPunches = isExp || !!(cur.inTime1 || cur.outTime1);
            return (
              <div key={entry.employeeId} className={`border-b border-zinc-200 last:border-b-0 ${ri % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}>
                <div className="grid grid-cols-[2fr_1fr_repeat(5,auto)] items-center">
                  {/* Name */}
                  <div className="px-3 py-2.5 border-r border-zinc-200">
                    <div className="text-xs font-bold text-zinc-900">{entry.employeeName}</div>
                    <div className="text-[10px] text-zinc-500">{entry.employeeCode} · {entry.designation}</div>
                  </div>
                  {/* Hours */}
                  <div className="px-2 py-2.5 border-r border-zinc-200 text-center">
                    {computed !== null ? (
                      <span className="text-xs font-bold text-blue-700 tabular-nums">{computed.toFixed(1)}h</span>
                    ) : (
                      <button onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(entry.employeeId)) n.delete(entry.employeeId); else n.add(entry.employeeId); return n; })} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                        {isExp ? <ChevronUp className="h-3.5 w-3.5 mx-auto" /> : <ChevronDown className="h-3.5 w-3.5 mx-auto" />}
                      </button>
                    )}
                  </div>
                  {/* Status buttons */}
                  {STATUS_OPTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStatus(entry.employeeId, s.value)}
                      className={`px-3 py-2.5 border-r border-zinc-200 last:border-r-0 text-xs font-bold transition-colors ${
                        cur.status === s.value
                          ? `${s.hd} text-white`
                          : `${s.col} text-zinc-400 hover:text-zinc-700`
                      }`}
                    >
                      {s.code}
                    </button>
                  ))}
                </div>

                {/* Punch times */}
                {showPunches && (
                  <div className="px-3 pb-2.5 pt-1 bg-zinc-50 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xl">
                    {([["inTime1", "A · IN 1"], ["outTime1", "B · OUT 1"], ["inTime2", "C · IN 2"], ["outTime2", "D · OUT 2"]] as const).map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[9px] font-bold tracking-[0.15em] text-zinc-500 uppercase block mb-0.5">{label}</label>
                        <Input
                          type="time"
                          value={cur[key]}
                          onChange={(e) => upd(entry.employeeId, { [key]: e.target.value } as any)}
                          className="h-7 text-xs font-mono rounded-none border-zinc-300"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Save bar */}
      <AnimatePresence>
        {dirtyCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-zinc-900 bg-zinc-900"
          >
            <div className="container mx-auto max-w-screen-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-zinc-300 font-mono">
                <span className="text-white font-bold">{dirtyCount}</span> unsaved {dirtyCount === 1 ? "change" : "changes"}
              </span>
              <button onClick={save} disabled={setMut.isPending} className="flex items-center gap-2 bg-amber-400 text-zinc-900 px-5 py-2 text-xs font-bold hover:bg-amber-300 disabled:opacity-50 transition-colors">
                <Save className="h-3.5 w-3.5" />
                {setMut.isPending ? "SAVING…" : "SAVE ATTENDANCE"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
