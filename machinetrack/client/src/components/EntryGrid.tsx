import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { Operator, BreakdownReason, Item } from "@shared/schema";
import type { GridRow } from "@/lib/productionGrid";
import { getItemsForMachine, workedMinutesForHour } from "@/lib/productionGrid";

// Below this efficiency, the cell shows a (required) reason dropdown.
export const REASON_THRESHOLD_PCT = 90;

interface Props {
  rows: GridRow[];
  hours: string[];
  shift: string;
  isAdmin: boolean;
  operators: Operator[];
  reasons: BreakdownReason[];
  items: Item[];
  savingHour: number | null;
  onItemChange: (rowIdx: number, itemId: number | null) => void;
  onOpeningChange: (rowIdx: number, value: number) => void;
  onClosingChange: (rowIdx: number, hourIdx: number, value: number) => void;
  onOperatorChange: (rowIdx: number, name: string) => void;
  onReasonChange: (rowIdx: number, hourIdx: number, reasonId: number | null) => void;
  onSplitRow: (machineId: number) => void;
  onDeleteRow: (rowIdx: number) => void;
  onSaveHour: (hourIdx: number) => Promise<void>;
  onUnlockHour: (hourIdx: number) => Promise<void>;
}

export default function EntryGrid({
  rows,
  hours,
  shift,
  isAdmin,
  operators,
  reasons,
  items,
  savingHour,
  onItemChange,
  onOpeningChange,
  onClosingChange,
  onOperatorChange,
  onReasonChange,
  onSplitRow,
  onDeleteRow,
  onSaveHour,
  onUnlockHour,
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
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase sticky left-0 bg-muted/20 z-20 min-w-[110px]">Machine</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase sticky left-[110px] bg-muted/20 z-20 min-w-[160px] border-r">Item</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase min-w-[120px]">Operator</th>
              <th className="text-center px-2 py-2 text-xs font-semibold uppercase min-w-[90px]">Opening</th>
              {hours.map((h, i) => (
                <th
                  key={`th-${i}`}
                  className="text-center px-2 py-2 text-xs font-semibold uppercase font-mono min-w-[90px]"
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
                <tr key={row.rowKey} className="border-b hover:bg-muted/10">
                  <td className="px-3 py-2 sticky left-0 bg-card z-10 min-w-[110px]">
                    <div className="flex items-center gap-2">
                      {row.dirty && <AlertTriangle size={12} className="text-amber-500" />}
                      <div>
                        <p className="font-semibold font-mono text-xs">{row.machine.machineNumber}</p>
                        <p className="text-xs text-muted-foreground">{row.machine.machineType}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSplitRow(row.machineId)}
                            className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                            title="Add another row for this machine (running a different item)"
                          >
                            <Plus size={9} /> Split
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteRow(rowIdx)}
                              className="text-[10px] text-destructive hover:underline inline-flex items-center gap-0.5"
                              title={
                                row.rowKey.startsWith("saved-")
                                  ? "Delete this saved entry (admin)"
                                  : "Remove this row"
                              }
                            >
                              <Trash2 size={9} /> Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-2 sticky left-[110px] bg-card z-10 border-r min-w-[180px]">
                    {/* Item picker: operator/admin chooses which item is running on this machine.
                        Lists only items that have a rate defined for this machine. */}
                    <select
                      value={row.itemId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) : null;
                        onItemChange(rowIdx, v);
                      }}
                      className={`w-full px-2 py-1 border rounded text-xs ${
                        row.itemId == null
                          ? "border-amber-400 bg-amber-50"
                          : "border-input"
                      }`}
                    >
                      <option value="">— Pick item —</option>
                      {getItemsForMachine(row.machineId, items).map(({ item, rate }) => (
                        <option key={item.id} value={item.id}>
                          {item.itemName} ({rate}/hr)
                        </option>
                      ))}
                    </select>
                    {row.itemId != null && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        Target: {row.expected} pcs/hr
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2 min-w-[120px]">
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

                  <td className="px-2 py-2 text-center bg-muted/10 min-w-[90px]">
                    {row.itemId == null ? (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    ) : (
                      <OpeningReadingInput
                        value={row.openingReading}
                        onCommit={(v) => onOpeningChange(rowIdx, v)}
                      />
                    )}
                  </td>

                  {row.entries.map((entry, hourIdx) => {
                    const isLocked = Array.isArray(row.lockedHours)
                      ? row.lockedHours.includes(hourIdx)
                      : false;
                    const noItem = row.itemId == null;
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
                    // A reason is needed when:
                    //   1. Operator entered a closing reading (so the hour was attempted)
                    //   2. Efficiency for that hour fell below threshold
                    const reasonNeeded =
                      entry.closingReading != null &&
                      entry.expected > 0 &&
                      pct < REASON_THRESHOLD_PCT;
                    const missingReason = reasonNeeded && entry.reasonId == null;
                    return (
                      <td
                        key={`cell-${row.machineId}-${row.itemId}-${hourIdx}`}
                        className={`px-1 py-2 text-center align-top min-w-[90px] ${cellBg} ${
                          missingReason ? "ring-1 ring-inset ring-red-300" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {noItem ? (
                            <span className="w-16 text-center text-xs text-muted-foreground italic">
                              —
                            </span>
                          ) : isLocked ? (
                            <span className="w-16 text-center text-xs font-mono font-semibold text-muted-foreground">
                              {entry.closingReading ?? "—"}
                            </span>
                          ) : (
                            <ClosingReadingInput
                              value={entry.closingReading}
                              onCommit={(v) => onClosingChange(rowIdx, hourIdx, v)}
                            />
                          )}
                          {!noItem && (
                            <span className="text-xs text-muted-foreground font-mono leading-none">
                              {entry.actual}/{entry.expected}
                            </span>
                          )}
                          {!noItem && workedMinutesForHour(entry.hour) < 60 && (
                            <span
                              className="text-[9px] text-amber-600 italic leading-none"
                              title={`Lunch break — only ${workedMinutesForHour(entry.hour)} min of work in this hour`}
                            >
                              lunch ({workedMinutesForHour(entry.hour)}m)
                            </span>
                          )}
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
                          {/* Reason dropdown only appears for sub-threshold cells.
                              Stays hidden when on-target so the grid doesn't bloat. */}
                          {reasonNeeded && !isLocked && (
                            <select
                              value={entry.reasonId ?? ""}
                              onChange={(e) => {
                                const v = e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null;
                                onReasonChange(rowIdx, hourIdx, v);
                              }}
                              className={`mt-1 w-full max-w-[110px] px-1 py-0.5 border rounded text-[10px] font-semibold ${
                                missingReason
                                  ? "border-red-400 bg-white text-red-700"
                                  : "border-input bg-white"
                              }`}
                              title={
                                missingReason
                                  ? "A reason is required for this hour"
                                  : "Reason"
                              }
                            >
                              <option value="">— pick reason —</option>
                              {reasons
                                .filter((r) => r.status === "active")
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          )}
                          {reasonNeeded && isLocked && entry.reasonId != null && (
                            <span className="mt-1 text-[10px] text-muted-foreground italic max-w-[110px] truncate">
                              {reasons.find((r) => r.id === entry.reasonId)?.name ?? ""}
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
              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/20 z-10">
                Save Hour
              </td>
              <td className="sticky left-[110px] bg-muted/20 z-10 border-r" />
              <td />
              <td />
              {hours.map((h, i) => {
                // An hour is locked overall if ALL rows have it locked
                const allLocked =
                  rows.length > 0 &&
                  rows.every(
                    (r) => Array.isArray(r.lockedHours) && r.lockedHours.includes(i)
                  );
                const isSaving = savingHour === i;

                // For the undo button, compute the earliest savedAt across rows
                // — used to show how long ago this hour was saved (operator
                // window is 10 min). Admin can undo any time.
                let earliestMs: number | null = null;
                if (allLocked) {
                  for (const r of rows) {
                    const t = r.hourSavedAt?.[String(i)];
                    if (t) {
                      const ms = new Date(t).getTime();
                      if (earliestMs == null || ms < earliestMs) earliestMs = ms;
                    }
                  }
                }
                const ageMin =
                  earliestMs != null
                    ? Math.round((Date.now() - earliestMs) / 60000)
                    : null;
                const canOperatorUndo = ageMin != null && ageMin <= 10;
                const canUndo = isAdmin || canOperatorUndo;

                return (
                  <td key={`save-${i}`} className="px-1 py-2 text-center">
                    {allLocked ? (
                      <button
                        onClick={() => onUnlockHour(i)}
                        disabled={!canUndo}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded transition ${
                          canUndo
                            ? "text-green-700 bg-green-50 hover:bg-amber-50 hover:text-amber-700 border border-green-200 hover:border-amber-300"
                            : "text-green-600 bg-green-50 border border-green-200 cursor-not-allowed opacity-60"
                        }`}
                        title={
                          canUndo
                            ? `Click to undo${ageMin != null ? ` (saved ${ageMin} min ago)` : ""}`
                            : `Saved ${ageMin} min ago — only admin can undo after 10 minutes`
                        }
                      >
                        <CheckCircle2 size={10} /> Saved
                      </button>
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
