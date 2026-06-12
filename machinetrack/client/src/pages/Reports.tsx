import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { ProductionEntry, Machine, Item, HourlyEntry } from "@shared/schema";

function daysAgoYMD(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Escape a value for CSV: wrap in quotes, double up inner quotes.
function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

type ReportMode = "summary" | "hourly";

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(daysAgoYMD(30));
  const [dateTo, setDateTo] = useState(daysAgoYMD(0));
  const [machineId, setMachineId] = useState<string>("");
  const [shift, setShift] = useState<string>("");
  const [mode, setMode] = useState<ReportMode>("summary");

  const params = new URLSearchParams({ dateFrom, dateTo });
  if (machineId) params.set("machineId", machineId);
  if (shift) params.set("shift", shift);
  const url = `/api/entries?${params.toString()}`;

  const { data: entries = [], isLoading } = useQuery<ProductionEntry[]>({
    queryKey: [url],
  });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });

  const machineById = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m])),
    [machines]
  );
  const itemById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  const totals = useMemo(() => {
    const actual = entries.reduce((s, e) => s + (e.totalActual ?? 0), 0);
    const expected = entries.reduce((s, e) => s + (e.totalExpected ?? 0), 0);
    const eff = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    return { actual, expected, eff };
  }, [entries]);

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("Nothing to export");
      return;
    }

    if (mode === "summary") {
      const header = [
        "Date",
        "Shift",
        "Machine",
        "Machine Type",
        "Item",
        "Operator",
        "Opening",
        "Actual",
        "Target",
        "Efficiency %",
        "Notes",
      ];
      const rows = entries.map((e) => {
        const m = machineById[e.machineId];
        const it = e.itemId != null ? itemById[e.itemId] : undefined;
        const actual = e.totalActual ?? 0;
        const expected = e.totalExpected ?? 0;
        const eff = expected > 0 ? Math.round((actual / expected) * 100) : 0;
        return [
          e.date,
          e.shift,
          m?.machineNumber ?? "",
          m?.machineType ?? "",
          it?.itemName ?? "",
          e.operatorName ?? "",
          e.openingReading ?? 0,
          actual,
          expected,
          eff,
          e.notes ?? "",
        ];
      });
      downloadCsv(`machinetrack-summary-${dateFrom}-to-${dateTo}.csv`, header, rows);
    } else {
      // Hourly: one row per (entry, hour)
      const header = [
        "Date",
        "Shift",
        "Machine",
        "Item",
        "Operator",
        "Hour",
        "Closing",
        "Actual",
        "Target",
      ];
      const rows: unknown[][] = [];
      for (const e of entries) {
        const m = machineById[e.machineId];
        const it = e.itemId != null ? itemById[e.itemId] : undefined;
        const hours = (e.entries as HourlyEntry[]) ?? [];
        for (const h of hours) {
          rows.push([
            e.date,
            e.shift,
            m?.machineNumber ?? "",
            it?.itemName ?? "",
            e.operatorName ?? "",
            h.hour,
            h.closingReading ?? "",
            h.actual,
            h.expected,
          ]);
        }
      }
      downloadCsv(`machinetrack-hourly-${dateFrom}-to-${dateTo}.csv`, header, rows);
    }
    toast.success("Exported");
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Date-range reports with CSV export
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold hover:bg-primary/90"
        >
          <Download size={14} />
          Export CSV
        </button>
      </header>

      <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Machine</label>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="">All machines</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.machineNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Shift</label>
          <input
            type="text"
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            placeholder="(all)"
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Format</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ReportMode)}
            className="w-full px-3 py-2 border rounded text-sm"
          >
            <option value="summary">Summary (1 row per entry)</option>
            <option value="hourly">Hourly (1 row per hour)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="text-2xl font-bold font-mono mt-1">{entries.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Actual</p>
          <p className="text-2xl font-bold font-mono mt-1">
            {totals.actual.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Target</p>
          <p className="text-2xl font-bold font-mono mt-1">
            {totals.expected.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Efficiency</p>
          <p
            className={`text-2xl font-bold font-mono mt-1 ${
              totals.eff >= 95
                ? "text-green-600"
                : totals.eff >= 80
                ? "text-yellow-600"
                : totals.eff > 0
                ? "text-red-600"
                : ""
            }`}
          >
            {totals.expected > 0 ? `${totals.eff}%` : "—"}
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Shift</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Machine
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Item</th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                Actual
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                Target
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">Eff</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No entries in range.
                </td>
              </tr>
            )}
            {entries.slice(0, 200).map((e) => {
              const machine = machineById[e.machineId];
              const item = e.itemId != null ? itemById[e.itemId] : undefined;
              const actual = e.totalActual ?? 0;
              const expected = e.totalExpected ?? 0;
              const eff = expected > 0 ? Math.round((actual / expected) * 100) : 0;
              return (
                <tr key={e.id} className="border-t hover:bg-muted/10">
                  <td className="px-4 py-2 font-mono">{e.date}</td>
                  <td className="px-4 py-2">{e.shift}</td>
                  <td className="px-4 py-2 font-mono">{machine?.machineNumber ?? "—"}</td>
                  <td className="px-4 py-2">{item?.itemName ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">{actual}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                    {expected}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-semibold ${
                      eff >= 95
                        ? "text-green-600"
                        : eff >= 80
                        ? "text-yellow-600"
                        : eff > 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {expected > 0 ? `${eff}%` : "—"}
                  </td>
                </tr>
              );
            })}
            {entries.length > 200 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 text-center text-muted-foreground text-xs">
                  Showing first 200 rows. Use CSV export to see all {entries.length}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
