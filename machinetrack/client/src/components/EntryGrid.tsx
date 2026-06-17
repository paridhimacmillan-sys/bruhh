import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { Operator, BreakdownReason, Item } from "@shared/schema";
import type { GridRow } from "@/lib/productionGrid";
import { getItemsForMachine, workedMinutesForHour } from "@/lib/productionGrid";

// Below this efficiency, the cell shows a (required) reason dropdown.
export const REASON_THRESHOLD_PCT = 90;

// Format a Date as HH:MM in local time
function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Round a Date to the nearest whole hour (for shift-total target estimate)
function roundHr(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() >= 30) r.setHours(r.getHours() + 1);
  r.setMinutes(0, 0, 0);
  return r;
}

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
  onClosingChange: (rowIdx: number, hourIdx: number, value: number | null) => void;
  onOperatorChange: (rowIdx: number, name: string) => void;
  onOperator2Change: (rowIdx: number, name: string) => void;
  onOperatorChangeTimeChange: (rowIdx: number, time: string) => void;
  onReasonChange: (rowIdx: number, hourIdx: number, reasonId: number | null) => void;
  onSplitRow: (machineId: number) => void;
  onDeleteRow: (rowIdx: number) => void;
  onSaveHour: (hourIdx: number) => Promise<void>;
  onUnlockHour: (hourIdx: number) => Promise<void>;
  onSaveOpening: (rowIdx: number) => Promise<void>;
  onSaveClosing: (rowIdx: number) => Promise<void>;
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
  onOperator2Change,
  onOperatorChangeTimeChange,
  onReasonChange,
  onSplitRow,
  onDeleteRow,
  onSaveHour,
  onUnlockHour,
  onSaveOpening,
  onSaveClosing,
}: Props) {
  // Two horizontal scroll bars — one mirrored at the top of the grid,
  // one at the natural bottom — synced so you can scroll from either.
  // Useful for tall grids where the bottom bar is off-screen.
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLTableElement>(null);
  const syncingRef = useRef(false);
  const [tableWidth, setTableWidth] = useState(0);

  // Tracks which rows have the handover (2nd operator + change time) UI
  // expanded. A row is also implicitly expanded if it already has any
  // handover data saved — the check is `expanded || hasData`.
  const [handoverExpanded, setHandoverExpanded] = useState<Set<string>>(
    new Set()
  );
  const toggleHandover = (rowKey: string) => {
    setHandoverExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  // Mirror the table's actual rendered width into the top scrollbar's inner
  // div so the proxy scrollbar matches the real scroll range. Recalculate on
  // resize / row count changes.
  useEffect(() => {
    if (!tableInnerRef.current) return;
    const update = () => {
      setTableWidth(tableInnerRef.current?.scrollWidth ?? 0);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(tableInnerRef.current);
    return () => ro.disconnect();
  }, [rows.length, hours.length]);

  // Bidirectional scroll sync. The syncingRef latch prevents an infinite
  // loop where each scroll event triggers the other.
  const onTopScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };
  const onTableScroll = () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (tableScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center text-sm text-muted-foreground">
        No active machines for this date and shift. Add machines under Masters.
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-3 py-1 border-b bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
        Hourly Production Grid — Shift {shift}
      </div>

      {/* Top scrollbar — mirrors the real grid scroll so users don't have to
          drag down to the bottom to scroll horizontally. The inner div's
          width is kept in sync with the real table's scrollWidth via the
          ResizeObserver in the effect above. */}
      <div
        ref={topScrollRef}
        onScroll={onTopScroll}
        className="overflow-x-auto overflow-y-hidden border-b bg-muted/10"
        style={{ height: 14 }}
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>

      <div
        ref={tableScrollRef}
        onScroll={onTableScroll}
        className="overflow-x-auto"
      >
        <table ref={tableInnerRef} className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/20">
              <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase sticky left-0 bg-muted/20 z-20 min-w-[88px]">Machine</th>
              <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase sticky left-[88px] bg-muted/20 z-20 min-w-[150px] border-r">Item</th>
              <th className="text-left px-2 py-2 text-[10px] font-semibold uppercase min-w-[110px]">Operator</th>
              <th className="text-center px-1 py-1 text-[10px] font-semibold uppercase min-w-[80px]">Opening</th>
              {hours.map((h, i) => (
                <th
                  key={`th-${i}`}
                  className="text-center px-1 py-1 text-[10px] font-semibold uppercase font-mono min-w-[80px]"
                >
                  {h}
                </th>
              ))}
              <th className="text-right px-2 py-1 text-[10px] font-semibold uppercase">Total</th>
              <th className="text-right px-2 py-1 text-[10px] font-semibold uppercase">Var</th>
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
                  <td className="px-2 py-0.5 sticky left-0 bg-card z-10 min-w-[88px]">
                    <div className="flex items-center gap-1">
                      {row.dirty && <AlertTriangle size={10} className="text-amber-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-semibold font-mono text-[11px] leading-none">{row.machine.machineNumber}</p>
                        <p className="text-[9px] text-muted-foreground leading-none truncate mt-0.5">{row.machine.machineType}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSplitRow(row.machineId)}
                            className="text-[9px] text-primary hover:bg-primary/10 inline-flex items-center justify-center w-4 h-4 rounded"
                            title="Add another row for this machine (different item)"
                          >
                            <Plus size={10} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteRow(rowIdx)}
                              className="text-[9px] text-destructive hover:bg-destructive/10 inline-flex items-center justify-center w-4 h-4 rounded"
                              title={
                                row.rowKey.startsWith("saved-")
                                  ? "Delete this saved entry (admin)"
                                  : "Remove this row"
                              }
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-0.5 sticky left-[88px] bg-card z-10 border-r min-w-[150px]">
                    {/* Item picker: operator/admin chooses which item is running on this machine.
                        Lists only items that have a rate defined for this machine.
                        Rate appears inline in dropdown text — no separate target line needed. */}
                    <select
                      value={row.itemId ?? ""}
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) : null;
                        onItemChange(rowIdx, v);
                      }}
                      className={`w-full px-1 py-0 border rounded text-[11px] leading-tight ${
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
                  </td>

                  <td className="px-2 py-0.5 min-w-[110px]">
                    <select
                      value={row.operatorName}
                      onChange={(e) => onOperatorChange(rowIdx, e.target.value)}
                      className="w-full px-1 py-0 border rounded text-[11px] leading-tight"
                    >
                      <option value="">Unassigned</option>
                      {operators.map((o) => (
                        <option key={o.id} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    {/* Second operator + change time. Collapsed to a small
                        link when unused; expanded to dual inputs when active.
                        Server enforces "both or neither" — amber outline if
                        only one is filled. */}
                    {(() => {
                      const op2 = row.operatorName2 ?? "";
                      const chg = row.operatorChangeTime ?? "";
                      // Expanded if user clicked "+ handover" OR there's
                      // existing saved data.
                      const hasData = !!op2.trim() || !!chg.trim();
                      const isExpanded =
                        handoverExpanded.has(row.rowKey) || hasData;
                      if (!isExpanded) {
                        return (
                          <button
                            type="button"
                            onClick={() => toggleHandover(row.rowKey)}
                            className="mt-0.5 text-[9px] text-muted-foreground hover:text-primary"
                            title="Add a second operator (handover mid-shift)"
                          >
                            + handover
                          </button>
                        );
                      }
                      const mismatched =
                        (op2.trim() && !chg.trim()) ||
                        (!op2.trim() && chg.trim());
                      const ring = mismatched
                        ? "border-amber-400 bg-amber-50"
                        : "";
                      return (
                        <div className="mt-0.5 flex gap-0.5 items-center">
                          <select
                            value={op2}
                            onChange={(e) =>
                              onOperator2Change(rowIdx, e.target.value)
                            }
                            className={`flex-1 min-w-0 px-1 py-0 border rounded text-[10px] ${ring}`}
                            title="Second operator (handover mid-shift)"
                          >
                            <option value="">— none —</option>
                            {operators.map((o) => (
                              <option key={o.id} value={o.name}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={chg}
                            onChange={(e) =>
                              onOperatorChangeTimeChange(rowIdx, e.target.value)
                            }
                            className={`w-[60px] px-0.5 py-0 border rounded text-[10px] font-mono ${ring}`}
                            title="Time of handover (HH:MM)"
                          />
                          {!hasData && (
                            <button
                              type="button"
                              onClick={() => toggleHandover(row.rowKey)}
                              className="text-[10px] text-muted-foreground hover:text-destructive leading-none"
                              title="Hide handover fields"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  <td className="px-1 py-0.5 text-center bg-muted/10 min-w-[80px]">
                    {row.itemId == null ? (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <OpeningReadingInput
                          value={row.openingReading}
                          onCommit={(v) => onOpeningChange(rowIdx, v)}
                        />
                        {row.trackingMode === "shift_total" &&
                          (row.openingAt ? (
                            <span
                              className="text-[9px] text-green-700 font-mono leading-none"
                              title={`Clocked at ${row.openingAt.toLocaleString()}`}
                            >
                              ✓ {formatHHMM(row.openingAt)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSaveOpening(rowIdx)}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 leading-none"
                              title="Clock the start time for this shift"
                            >
                              Save Opening
                            </button>
                          ))}
                      </div>
                    )}
                  </td>

                  {row.trackingMode === "shift_total" ? (
                    /* SHIFT-TOTAL: single big cell spanning all the hour columns
                       with one closing reading + Save Closing button. The target
                       is computed by the server from elapsed time. */
                    <td
                      colSpan={hours.length}
                      className="px-3 py-2 text-center bg-blue-50/40"
                    >
                      {row.itemId == null ? (
                        <span className="text-xs text-muted-foreground italic">
                          Pick an item to start tracking this shift
                        </span>
                      ) : !row.openingAt ? (
                        <span className="text-xs text-muted-foreground italic">
                          Enter opening reading and click <b>Save Opening</b> to start
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            Started {formatHHMM(row.openingAt)} •
                            {row.closingAt
                              ? ` ended ${formatHHMM(row.closingAt)}`
                              : " running…"}
                          </span>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                              Closing reading
                            </span>
                            <ClosingReadingInput
                              value={
                                row.entries[row.entries.length - 1]
                                  ?.closingReading ?? null
                              }
                              onCommit={(v) =>
                                onClosingChange(
                                  rowIdx,
                                  row.entries.length - 1,
                                  v
                                )
                              }
                            />
                          </div>
                          {row.closingAt ? (
                            <span
                              className="text-[10px] text-green-700 font-mono"
                              title={`Clocked at ${row.closingAt.toLocaleString()}`}
                            >
                              ✓ Closed @ {formatHHMM(row.closingAt)}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSaveClosing(rowIdx)}
                              className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                              title="Clock the end time for this shift"
                            >
                              Save Closing
                            </button>
                          )}
                          {(() => {
                            const last = row.entries[row.entries.length - 1];
                            if (!last || last.closingReading == null) return null;
                            const actual = last.actual;
                            // Target only known after server save; show last
                            // saved expected if any, otherwise live estimate.
                            const target =
                              row.entries.reduce(
                                (s, e) => s + (e.expected || 0),
                                0
                              ) ||
                              (row.openingAt && row.closingAt
                                ? Math.round(
                                    (row.expected *
                                      Math.max(
                                        0,
                                        (roundHr(row.closingAt).getTime() -
                                          roundHr(row.openingAt).getTime()) /
                                          60000
                                      )) /
                                      60
                                  )
                                : 0);
                            const eff =
                              target > 0
                                ? Math.round((actual / target) * 100)
                                : 0;
                            const effColor =
                              eff >= 95
                                ? "text-green-700"
                                : eff >= 80
                                ? "text-amber-700"
                                : "text-red-600";
                            return (
                              <span
                                className={`text-xs font-semibold font-mono ${effColor}`}
                              >
                                {actual} / {target} ({eff}%)
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                  ) : (
                  row.entries.map((entry, hourIdx) => {
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
                        className={`px-0.5 py-0.5 text-center align-top min-w-[80px] ${cellBg} ${
                          missingReason ? "ring-1 ring-inset ring-red-300" : ""
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {noItem ? (
                            <span className="w-14 text-center text-[10px] text-muted-foreground italic">
                              —
                            </span>
                          ) : isLocked ? (
                            <span className="w-14 text-center text-[10px] font-mono font-semibold text-muted-foreground">
                              {entry.closingReading ?? "—"}
                            </span>
                          ) : (
                            <ClosingReadingInput
                              value={entry.closingReading}
                              onCommit={(v) => onClosingChange(rowIdx, hourIdx, v)}
                            />
                          )}
                          {!noItem && (
                            <span className="text-[9px] text-muted-foreground font-mono leading-none">
                              {entry.actual}/{entry.expected}
                            </span>
                          )}
                          {!noItem &&
                            (() => {
                              const worked = workedMinutesForHour(entry.hour, hours);
                              if (worked >= 60) return null;
                              // Build a human label explaining WHICH allowance(s)
                              // are deducting from this hour.
                              const isLunch = entry.hour === "14:00";
                              const isFirst = entry.hour === hours[0];
                              const isLast = entry.hour === hours[hours.length - 1];
                              const isTea =
                                entry.hour === "11:00" || entry.hour === "18:00";
                              const tags: string[] = [];
                              if (isLunch) tags.push("lunch");
                              if (isFirst) tags.push("start");
                              if (isLast) tags.push("end");
                              if (isTea) tags.push("tea");
                              const label = tags.join("+") || "break";
                              return (
                                <span
                                  className="text-[9px] text-amber-600 italic leading-none"
                                  title={`${label} allowance — only ${worked} min of work in this hour`}
                                >
                                  {label} ({worked}m)
                                </span>
                              );
                            })()}
                          {/* % efficiency text removed to save vertical space.
                              The cell background color (green/yellow/red) already
                              conveys the same info at a glance. */}
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
                          {/* Reason name caption removed to save vertical space.
                              The reason is still saved with the entry — see the
                              Recent Entries page or Reports for the reason audit. */}
                        </div>
                      </td>
                    );
                  }))}

                  <td className="px-2 py-0.5 text-right">
                    <span className="font-mono font-bold text-[11px]">
                      {totalActual > 0 ? totalActual : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    <span
                      className={`font-mono text-[11px] font-semibold ${
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
                      <p className="text-[10px] font-mono text-muted-foreground leading-none mt-0.5">
                        {Math.round(eff)}%
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Per-hour save buttons row. Hidden entirely when all rows are
              shift-total (those save via inline "Save Closing"). When mixed,
              only counts hourly rows for the "all locked" check. */}
          {rows.some((r) => r.trackingMode !== "shift_total") && (
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/20 z-10">
                Save Hour
              </td>
              <td className="sticky left-[88px] bg-muted/20 z-10 border-r" />
              <td />
              <td />
              {hours.map((h, i) => {
                // Only count rows in HOURLY mode — shift-total rows don't
                // participate in per-hour locking.
                const hourlyRows = rows.filter(
                  (r) => r.trackingMode !== "shift_total"
                );
                const allLocked =
                  hourlyRows.length > 0 &&
                  hourlyRows.every(
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
          )}
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
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const commit = () => {
    // Empty input means "no reading entered for this hour" (gap). Send null
    // so the validator treats it as skipped, not as "produced -1940 pcs".
    if (draft === "") {
      onCommit(null);
      return;
    }
    const v = parseInt(draft, 10);
    onCommit(isNaN(v) ? null : Math.max(0, v));
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
      className="w-14 px-0.5 py-0.5 border rounded text-[10px] text-center font-mono"
      placeholder="Close"
      min={0}
    />
  );
}
