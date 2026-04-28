import { useRoute, Link } from "wouter";
import { useGetEmployee, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { ArrowLeft } from "lucide-react";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const LEAVE_HDS: Record<string, string> = {
  CL: "bg-blue-700", SL: "bg-pink-700", EL: "bg-green-700", LOP: "bg-zinc-600",
};
const LEAVE_VALS: Record<string, { bar: string; txt: string }> = {
  CL:  { bar: "bg-blue-500",  txt: "text-blue-800"  },
  SL:  { bar: "bg-pink-500",  txt: "text-pink-800"  },
  EL:  { bar: "bg-green-500", txt: "text-green-800" },
  LOP: { bar: "bg-zinc-500",  txt: "text-zinc-800"  },
};

export default function EmployeeDetail() {
  const [, params] = useRoute("/employees/:employeeId");
  const employeeId = Number(params?.employeeId);
  const { data, isLoading } = useGetEmployee(employeeId, {
    query: { enabled: !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) },
  });

  if (isLoading) {
    return (
      <div className="space-y-3" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-zinc-100 animate-pulse border-2 border-zinc-200" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const e = data.employee;
  const lb = data.leaveBalance;

  const THIS_MONTH_STATS = [
    { label: "ATTENDANCE RATE", value: `${data.monthAttendanceRate}%`, hd: "bg-blue-700", val: "text-blue-700" },
    { label: "DAYS PRESENT",    value: data.daysPresentThisMonth,      hd: "bg-green-700", val: "text-green-700" },
    { label: "DAYS ABSENT",     value: data.daysAbsentThisMonth,       hd: "bg-red-700",   val: "text-red-700"  },
    { label: "OT HRS / MO",     value: data.overtimeHoursThisMonth,    hd: "bg-amber-600", val: "text-amber-700" },
  ];

  return (
    <div className="space-y-5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* Back */}
      <Link href="/employees">
        <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-bold tracking-wider uppercase">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Employees
        </button>
      </Link>

      {/* Employee identity card */}
      <div className="border-2 border-zinc-900">
        <div className="bg-zinc-900 px-5 py-2 flex items-center gap-3">
          <span className="text-amber-400 text-base font-bold tracking-wider">{e.employeeCode}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-white text-xs font-bold tracking-wider uppercase">{e.departmentName}</span>
          <span className="ml-auto text-zinc-500 text-[10px] tracking-wider">{e.designation}</span>
        </div>
        <div className="bg-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-bold text-zinc-900">{e.name}</div>
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-zinc-500">
              {!e.statsEligible && <span className="bg-zinc-200 px-2 py-0.5 font-bold text-zinc-700">NO STATS / NO PF</span>}
              {!e.otEligible   && <span className="bg-zinc-200 px-2 py-0.5 font-bold text-zinc-700">NOT OT ELIGIBLE</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">Monthly Wage</div>
            <div className="text-2xl font-bold text-zinc-900 tabular-nums">{inr(e.monthlyWage)}</div>
          </div>
        </div>
      </div>

      {/* This month stats */}
      <div className="border-2 border-zinc-900">
        <div className="grid grid-cols-4 text-[9px] font-bold tracking-[0.15em] text-white uppercase">
          {THIS_MONTH_STATS.map((s) => (
            <div key={s.label} className={`${s.hd} px-4 py-1.5 border-r border-white/20 last:border-r-0`}>{s.label}</div>
          ))}
        </div>
        <div className="grid grid-cols-4 bg-white">
          {THIS_MONTH_STATS.map((s) => (
            <div key={s.label} className="px-4 py-4 border-r border-zinc-200 last:border-r-0">
              <div className={`text-3xl font-bold tabular-nums ${s.val}`}>{s.value}</div>
              <div className="text-[9px] text-zinc-400 uppercase tracking-wider mt-1">This month</div>
            </div>
          ))}
        </div>
      </div>

      {/* Leave balance */}
      <div className="border-2 border-zinc-900">
        <div className="bg-zinc-900 px-5 py-2 text-[9px] font-bold tracking-[0.25em] text-zinc-400 uppercase">
          Leave Balance
        </div>
        <div className="grid grid-cols-4 border-t border-zinc-700">
          {(["CL", "SL", "EL", "LOP"] as const).map((k) => {
            const b = lb[k];
            const isLop = k === "LOP";
            const pct = !isLop && b.allotted > 0 ? Math.round((b.remaining / b.allotted) * 100) : 0;
            const v = LEAVE_VALS[k];
            return (
              <div key={k} className="border-r border-zinc-200 last:border-r-0">
                <div className={`${LEAVE_HDS[k]} text-white text-[9px] font-bold tracking-[0.2em] uppercase px-4 py-1.5`}>
                  {k}
                </div>
                <div className="bg-white px-4 py-4">
                  <div className={`text-3xl font-bold tabular-nums ${v.txt}`}>
                    {isLop ? b.used : b.remaining}
                  </div>
                  {!isLop ? (
                    <>
                      <div className="text-[10px] text-zinc-500 mt-1">{b.used} used of {b.allotted}</div>
                      {/* Mini progress bar */}
                      <div className="mt-2 h-1.5 bg-zinc-200 rounded-none">
                        <div className={`h-full ${v.bar} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-zinc-500 mt-1">days lost pay</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
