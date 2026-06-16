import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ProductionEntry,
  Machine,
  Item,
  HourlyEntry,
  ItemRate,
} from "@shared/schema";

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
  // Default: today only. User can change "To" date for a range.
  const [dateFrom, setDateFrom] = useState(daysAgoYMD(0));
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

  // Build the machine-wise aggregate used for the PDF report.
  // Groups all entries by machineId; sums actual/target across the date range;
  // collects unique items + operators; computes loss-minutes per entry using
  // the item's hourly rate (shortfall_pcs / rate * 60), then sums per machine.
  const machineRollup = useMemo(() => {
    type Roll = {
      machineId: number;
      machineNumber: string;
      machineType: string;
      itemSet: Set<string>;
      operatorSet: Set<string>;
      actual: number;
      expected: number;
      lossMinutes: number;
      entryCount: number;
    };
    const byMachine = new Map<number, Roll>();

    for (const e of entries) {
      const m = machineById[e.machineId];
      if (!m) continue;
      if (!byMachine.has(e.machineId)) {
        byMachine.set(e.machineId, {
          machineId: e.machineId,
          machineNumber: m.machineNumber,
          machineType: m.machineType,
          itemSet: new Set(),
          operatorSet: new Set(),
          actual: 0,
          expected: 0,
          lossMinutes: 0,
          entryCount: 0,
        });
      }
      const r = byMachine.get(e.machineId)!;
      r.actual += e.totalActual ?? 0;
      r.expected += e.totalExpected ?? 0;
      r.entryCount++;
      if (e.itemId != null) {
        const it = itemById[e.itemId];
        if (it) r.itemSet.add(it.itemName);
      }
      if (e.operatorName) r.operatorSet.add(e.operatorName);
      if (e.operatorName2) r.operatorSet.add(e.operatorName2);

      // Loss minutes for THIS entry: shortfall_pcs / rate × 60
      // Look up the item's hourly rate on this machine.
      const it = e.itemId != null ? itemById[e.itemId] : undefined;
      const rates = it && Array.isArray(it.rates)
        ? (it.rates as ItemRate[])
        : [];
      const rate = rates.find((rt) => rt?.machineId === e.machineId)?.rate ?? 0;
      const shortfall = Math.max(
        0,
        (e.totalExpected ?? 0) - (e.totalActual ?? 0)
      );
      if (rate > 0 && shortfall > 0) {
        r.lossMinutes += (shortfall / rate) * 60;
      }
    }

    return Array.from(byMachine.values()).sort((a, b) =>
      a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true })
    );
  }, [entries, machineById, itemById]);

  // Generate a PDF report — one page header + a table with one row per machine.
  const handleExportPdf = () => {
    if (machineRollup.length === 0) {
      toast.error("Nothing to export");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Machine-wise Production Report", pageW / 2, 36, { align: "center" });

    // Date range subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const rangeLabel =
      dateFrom === dateTo ? `Date: ${dateFrom}` : `Period: ${dateFrom} → ${dateTo}`;
    doc.text(rangeLabel, pageW / 2, 54, { align: "center" });

    // Filter info
    const filterParts: string[] = [];
    if (machineId) {
      const m = machineById[parseInt(machineId, 10)];
      filterParts.push(`Machine: ${m?.machineNumber ?? machineId}`);
    }
    if (shift) filterParts.push(`Shift: ${shift}`);
    if (filterParts.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(filterParts.join("  •  "), pageW / 2, 68, { align: "center" });
      doc.setTextColor(0);
    }

    // Overall summary box
    const overallActual = machineRollup.reduce((s, r) => s + r.actual, 0);
    const overallExpected = machineRollup.reduce((s, r) => s + r.expected, 0);
    const overallEff =
      overallExpected > 0 ? Math.round((overallActual / overallExpected) * 100) : 0;
    const overallLoss = Math.round(
      machineRollup.reduce((s, r) => s + r.lossMinutes, 0)
    );

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const summaryY = 88;
    const summary = [
      `Machines: ${machineRollup.length}`,
      `Actual: ${overallActual.toLocaleString()}`,
      `Target: ${overallExpected.toLocaleString()}`,
      `Efficiency: ${overallEff}%`,
      `Total Loss: ${overallLoss} min (${(overallLoss / 60).toFixed(1)} hr)`,
    ];
    doc.text(summary.join("    |    "), pageW / 2, summaryY, { align: "center" });

    // Data table
    autoTable(doc, {
      startY: 105,
      head: [[
        "Machine",
        "Type",
        "Items",
        "Operators",
        "Actual",
        "Target",
        "Eff %",
        "Loss (min)",
      ]],
      body: machineRollup.map((r) => {
        const eff = r.expected > 0 ? Math.round((r.actual / r.expected) * 100) : 0;
        const itemList = Array.from(r.itemSet).join(", ") || "—";
        const opList = Array.from(r.operatorSet).join(", ") || "—";
        return [
          r.machineNumber,
          r.machineType,
          itemList,
          opList,
          r.actual.toLocaleString(),
          r.expected.toLocaleString(),
          `${eff}%`,
          Math.round(r.lossMinutes).toString(),
        ];
      }),
      foot: [[
        "TOTAL",
        "",
        "",
        "",
        overallActual.toLocaleString(),
        overallExpected.toLocaleString(),
        `${overallEff}%`,
        overallLoss.toString(),
      ]],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [60, 80, 180], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60 },
        1: { cellWidth: 90 },
        2: { cellWidth: 180 },
        3: { cellWidth: 110 },
        4: { halign: "right", cellWidth: 60 },
        5: { halign: "right", cellWidth: 60 },
        6: { halign: "right", cellWidth: 50 },
        7: { halign: "right", cellWidth: 60 },
      },
      // Color the efficiency cell red/yellow/green based on value
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 6) {
          const eff = parseInt(String(data.cell.raw).replace("%", ""), 10);
          if (!isNaN(eff)) {
            if (eff < 80) data.cell.styles.textColor = [200, 30, 30];
            else if (eff < 95) data.cell.styles.textColor = [180, 120, 0];
            else data.cell.styles.textColor = [30, 130, 30];
          }
        }
        if (data.column.index === 7) {
          const loss = parseInt(String(data.cell.raw), 10);
          if (!isNaN(loss) && loss > 60) {
            data.cell.styles.textColor = [200, 30, 30];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // Footer with generation timestamp
    const finalY = (doc as any).lastAutoTable.finalY ?? 200;
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Generated: ${new Date().toLocaleString()}   •   MachineTrack`,
      pageW / 2,
      finalY + 20,
      { align: "center" }
    );

    const fileName =
      dateFrom === dateTo
        ? `machinetrack-${dateFrom}.pdf`
        : `machinetrack-${dateFrom}-to-${dateTo}.pdf`;
    doc.save(fileName);
    toast.success("PDF downloaded");
  };

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
        "Operator 2",
        "Change Time",
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
          e.operatorName2 ?? "",
          e.operatorChangeTime ?? "",
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
            Date-range reports with CSV and PDF export
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded text-sm font-semibold hover:bg-primary/10"
            title="Machine-wise PDF: one row per machine with loss minutes"
          >
            <FileText size={14} />
            PDF Report
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold hover:bg-primary/90"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
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
