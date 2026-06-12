import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Operator } from "@shared/schema";
import type { GridRow } from "@/lib/productionGrid";

interface Props {
  rows: GridRow[];
  hours: string[];
  shift: string;
  isAdmin: boolean;
  operators: Operator[];
  savingHour: number | null;
  onOpeningChange: (rowIdx: number, value: number) => void;
  onClosingChange: (rowIdx: number, hourIdx: number, value: number) => void;
  onOperatorChange: (rowIdx: number, name: string) => void;
  onSaveHour: (hourIdx: number) => Promise<void>;
}

export default function EntryGrid({
  rows,
  hours,
  shift,
  isAdmin,
  operators,
  savingHour,
  onOpeningChange,
  onClosingChange,
  onOperatorChange,
  onSaveHour,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center text-sm text-muted-foreground">
        No active machines for this date and shift. Add machines under Masters.
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
        Hourly Production Grid — Shift {shift}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">Machine</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">Item</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase">Operator</th>
              <th className="text-center px-2 py-2 text-xs font-semibold uppercase">Opening</th>
              {hours.map((h, i) => (
                <th
                  key={`th-${i}`}
                  className="text-center px-2 py-2 text-xs font-semibold uppercase font-mono"
                >
                  {h}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase">Total</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase">Var</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const totalActual = row.entries.reduce((s, e) => s + e.actual, 0);
              const totalExpected = row.entries.reduce((s, e) => s + e.expected, 0);
              const variance = totalActual - totalExpected;
              const eff = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;

              return (
                <tr key={`${row.machineId}-${row.itemId}`} className="border-b hover:bg-muted/10">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {row.dirty && <AlertTriangle size={12} className="text-amber-500" />}
                      <div>
                        <p className="font-semibold font-mono text-xs">{row.machine.machineNumber}</p>
                        <p className="text-xs text-muted-foreground">{row.machine.machineType}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2">
                    <p className="font-medium text-xs">{row.item.itemName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      Target: {row.expected} pcs/hr
                    </p>
                  </td>

                  <td className="px-3 py-2">
                    <select
                      value={row.operatorName}
                      onChange={(e) => onOperatorChange(rowIdx, e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs"
                    >
                      <option value="">Unassigned</option>
                      {operators.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-2 py-2 text-center bg-muted/10">
                    <OpeningReadingInput
                      value={row.openingReading}
                      onCommit={(v) => onOpeningChange(rowIdx, v)}
                    />
                  </td>

                  {row.entries.map((entry, hourIdx) => {
                    const isLocked = row.lockedHours.includes(hourIdx);
                    const pct =
                      entry.expected > 0 ? (entry.actual / entry.expected) * 100 : 0;
                    const cellBg =
                      entry.actual === 0
                        ? ""
                        : pct >= 95
                        ? "bg-green-50"
                        : pct >= 80
                        ? "bg-yellow-50"
                        : "bg-red-50";
                    return (
                      <td
                        key={`cell-${row.machineId}-${row.itemId}-${hourIdx}`}
                        className={`px-1 py-2 text-center ${cellBg}`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {isLocked ? (
                            <span className="w-16 text-center text-xs font-mono font-semibold text-muted-foreground">
                              {entry.closingReading ?? "—"}
                            </span>
                          ) : (
                            <ClosingReadingInput
                              value={entry.closingReading}
                              onCommit={(v) => onClosingChange(rowIdx, hourIdx, v)}
                            />
                          )}
                          <span className="text-xs text-muted-foreground font-mono leading-none">
                            {entry.actual}/{entry.expected}
                          </span>
                          {entry.actual > 0 && (
                            <span
                              className={`text-[10px] font-mono leading-none ${
                                pct >= 95
                                  ? "text-green-600"
                                  : pct >= 80
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {Math.round(pct)}%
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  <td className="px-3 py-2 text-right">
                    <span className="font-mono font-bold text-xs">
                      {totalActual > 0 ? totalActual : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        variance > 0
                          ? "text-green-600"
                          : variance < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {totalActual === 0 ? "—" : variance >= 0 ? `+${variance}` : variance}
                    </span>
                    {totalActual > 0 && (
                      <p className="text-xs font-mono text-muted-foreground">
                        {Math.round(eff)}%
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Per-hour save buttons row */}
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                Save Hour
              </td>
              {hours.map((h, i) => {
                // An hour is locked overall if ALL rows have it locked
                const allLocked = rows.every((r) => r.lockedHours.includes(i));
                const isSaving = savingHour === i;
                return (
                  <td key={`save-${i}`} className="px-1 py-2 text-center">
                    {allLocked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600">
                        <CheckCircle2 size={10} /> Saved
                      </span>
                    ) : (
                      <button
                        onClick={() => onSaveHour(i)}
                        disabled={isSaving || savingHour !== null}
                        className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isSaving ? "…" : `Save ${h}`}
                      </button>
                    )}
                  </td>
                );
              })}
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local-state input helpers. CRITICAL: commit on blur only, never per-keystroke.
// On commit, snap visible draft back to whatever the parent's value prop became.
// (If validation rejected the new value, the parent's value won't have changed,
// so resetting the draft to it effectively reverts the visible input.)
// ─────────────────────────────────────────────────────────────────────────────

function OpeningReadingInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(value === 0 ? "" : String(value));
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    setDraft(value === 0 ? "" : String(value));
  }, [value]);

  const commit = () => {
    if (draft === "") {
      onCommit(0);
      return;
    }
    const v = parseInt(draft, 10);
    onCommit(isNaN(v) ? 0 : Math.max(0, v));
    // If parent rejected the change, value prop won't change, so we revert to it.
    setTimeout(() => setDraft(valueRef.current === 0 ? "" : String(valueRef.current)), 0);
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-20 px-2 py-1 border rounded text-xs text-center font-mono"
      placeholder="Open"
      min={0}
    />
  );
}

function ClosingReadingInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const commit = () => {
    if (draft === "") {
      onCommit(0);
      return;
    }
    const v = parseInt(draft, 10);
    onCommit(isNaN(v) ? 0 : Math.max(0, v));
    setTimeout(
      () => setDraft(valueRef.current == null ? "" : String(valueRef.current)),
      0
    );
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-16 px-1 py-1 border rounded text-xs text-center font-mono"
      placeholder="Close"
      min={0}
    />
  );
}
