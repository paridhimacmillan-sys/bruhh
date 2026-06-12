import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Activity, Target, Gauge, CheckCircle2 } from "lucide-react";

interface DashboardData {
  summary: {
    totalActual: number;
    totalExpected: number;
    efficiency: number;
    machinesOnTarget: number;
    totalMachines: number;
  };
  machines: Array<{
    machineId: number;
    machineNumber: string;
    actual: number;
    expected: number;
    efficiency: number;
  }>;
  hourly: Array<{ hour: string; actual: number; expected: number }>;
  items: Array<{
    itemId: number;
    itemName: string;
    actual: number;
    expected: number;
    machineCount: number;
    efficiency: number;
  }>;
}

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [date, setDate] = useState(todayYMD());
  const url = `/api/dashboard?date=${encodeURIComponent(date)}`;
  const { data, isLoading } = useQuery<DashboardData>({ queryKey: [url] });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live shop-floor metrics for the selected date
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border rounded text-sm font-mono"
          />
        </div>
      </header>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading dashboard…</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Activity size={18} />}
              label="Total Actual"
              value={data.summary.totalActual.toLocaleString()}
              hint="pieces produced"
            />
            <KpiCard
              icon={<Target size={18} />}
              label="Target"
              value={data.summary.totalExpected.toLocaleString()}
              hint="pieces expected"
            />
            <KpiCard
              icon={<Gauge size={18} />}
              label="Efficiency"
              value={`${data.summary.efficiency}%`}
              hint={
                data.summary.efficiency >= 95
                  ? "Excellent"
                  : data.summary.efficiency >= 80
                  ? "On track"
                  : "Needs attention"
              }
              tone={
                data.summary.efficiency >= 95
                  ? "green"
                  : data.summary.efficiency >= 80
                  ? "amber"
                  : "red"
              }
            />
            <KpiCard
              icon={<CheckCircle2 size={18} />}
              label="On Target"
              value={`${data.summary.machinesOnTarget} / ${data.summary.totalMachines}`}
              hint="machines ≥ 95%"
            />
          </div>

          <section className="bg-card border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Hourly Trend</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Actual vs target across all machines
            </p>
            {data.hourly.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                No entries logged for this date.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.hourly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Actual"
                  />
                  <Line
                    type="monotone"
                    dataKey="expected"
                    stroke="#9ca3af"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    name="Target"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="bg-card border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Output by Machine</h2>
            {data.machines.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                No active machines.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.machines}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="machineNumber" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
                  <Bar dataKey="expected" fill="#d1d5db" name="Target" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="bg-card border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
              Items Produced
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                    Item
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                    Actual
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                    Target
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                    Machines
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                    Eff
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No items produced.
                    </td>
                  </tr>
                )}
                {data.items.map((i) => (
                  <tr key={i.itemId} className="border-t">
                    <td className="px-4 py-2">{i.itemName}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {i.actual.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {i.expected.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{i.machineCount}</td>
                    <td
                      className={`px-4 py-2 text-right font-mono font-semibold ${
                        i.efficiency >= 95
                          ? "text-green-600"
                          : i.efficiency >= 80
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {i.efficiency}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const toneClasses = {
    default: "",
    green: "text-green-600",
    amber: "text-yellow-600",
    red: "text-red-600",
  };
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <p className={`text-3xl font-bold mt-2 font-mono ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
