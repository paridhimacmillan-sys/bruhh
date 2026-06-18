import { useState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { Operator, BreakdownReason, Item } from "@shared/schema";
import type { GridRow } from "@/lib/productionGrid";
import { getItemsForMachine, workedMinutesForHour } from "@/lib/productionGrid";

// Below this efficiency, the cell shows a (required) reason dropdown.
export const REASON_THRESHOLD_PCT = 90;

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

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
  // Open the start-time picker for a row (admin click on the chip).
  onEditStartHour: (rowIdx: number) => void;
  // Highest hour index whose wall-clock end has been reached. Hours with a
  // greater index are still in the future and should NOT show their "Save
  // HH:00" button (operators can't close an hour that hasn't happened).
  // For past dates this is hours.length - 1; for future dates it's -1.
  maxSavableHourIdx: number;
  // For each hour index, whether an operator (non-admin) is still allowed
  // to undo a save for that hour. Cutoff is 5 min before the next hour's
  // end, i.e. hour-label + 55 min. Admins can undo any time regardless.
  operatorCanUndoByHour: boolean[];
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
  onEditStartHour,
  maxSavableHourIdx,
  operatorCanUndoByHour,
}: Props) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLTableElement>(null);
  const syncingRef = useRef(false);
  const [tableWidth, setTableWidth] = useState(0);

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

  // Precompute each row's active window [from, to] based on its startHourIdx
  // AND the NEXT row's startHourIdx for the same machine. Single-row machines
  // have window [0, hours.length-1] (no greying). This mirrors buildRows but
  // uses live state so unsaved edits to startHourIdx are reflected immediately.
  const rowWindows = rows.map((row, idx) => {
    const sameMachine = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.machineId === row.machineId);
    if (sameMachine.length < 2) {
      return { from: 0, to: hours.length - 1 };
    }
    const sorted = [...sameMachine].sort(
      (a, b) => (a.r.startHourIdx ?? 0) - (b.r.startHourIdx ?? 0)
    );
    const position = sorted.findIndex((x) => x.i === idx);
    const from = sorted[position].r.startHourIdx ?? 0;
    const nextFrom =
      position + 1 < sorted.length
        ? sorted[position + 1].r.startHourIdx ?? hours.length
        : hours.length;
    return { from, to: nextFrom - 1 };
  });

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-3 py-1 border-b bg-muted/40 text-[10px] font-semibold uppercase text-muted-foreground">
        Hourly Production Grid — Shift {shift}
      </div>

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
              const win = rowWindows[rowIdx];

              // Show "from HH:MM" chip when this row is part of a split
              // AND has a non-zero startHourIdx (otherwise the chip would
              // just say "from <first hour of shift>" which is implicit).
              const isSplitMachine =
                rows.filter((r) => r.machineId === row.machineId).length > 1;
              const showStartChip =
                isSplitMachine && (row.startHourIdx ?? 0) > 0;

              const isUnassigned = (row.operatorName ?? "").trim() === "";

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
                            title="Add another row for this machine (setting change)"
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
                    {/* Start-time chip on split rows. Admin clicks to reopen
                        the picker; operator just sees it as a static label. */}
                    {showStartChip && (
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => onEditStartHour(rowIdx)}
                        className={`mt-0.5 text-[9px] inline-flex items-center px-1 py-0 rounded font-mono ${
                          isAdmin
                            ? "text-primary hover:bg-primary/10 cursor-pointer"
                            : "text-muted-foreground cursor-default"
                        }`}
                        title={
                          isAdmin
                            ? "Click to change the start time"
                            : `Started running at ${hours[row.startHourIdx ?? 0]}`
                        }
                      >
                        from {hours[row.startHourIdx ?? 0] ?? "?"}
                      </button>
                    )}
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
                    {(() => {
                      const op2 = row.operatorName2 ?? "";
                      const chg = row.operatorChangeTime ?? "";
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
                            const effLocal =
                              target > 0
                                ? Math.round((actual / target) * 100)
                                : 0;
                            const effColor =
                              effLocal >= 95
                                ? "text-green-700"
                                : effLocal >= 80
                                ? "text-amber-700"
                                : "text-red-600";
                            return (
                              <span
                                className={`text-xs font-semibold font-mono ${effColor}`}
                              >
                                {actual} / {target} ({effLocal}%)
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
                    // Window-based greying:
                    //   outsideWindow → this hour is outside the row's active
                    //     [from, to] window — the row wasn't running then.
                    //   isUnassigned  → no operator picked = whole row idle.
                    const outsideWindow =
                      hourIdx < win.from || hourIdx > win.to;
                    const greyedOut = outsideWindow || isUnassigned;
                    const cellBg =
                      greyedOut
                        ? "bg-muted/30 opacity-50"
                        : entry.actual === 0
                        ? ""
                        : pct >= 95
                        ? "bg-green-50"
                        : pct >= 80
                        ? "bg-yellow-50"
                        : "bg-red-50";
                    const reasonNeeded =
                      !greyedOut &&
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
                        title={
                          outsideWindow
                            ? `${row.item?.itemName ?? "Item"} was not running at ${entry.hour}`
                            : isUnassigned
                            ? "No operator assigned for this shift"
                            : undefined
                        }
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {noItem || greyedOut ? (
                            <span className="w-14 text-center text-[10px] text-muted-foreground italic">
                              {isUnassigned ? "off" : "—"}
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
                          {/* The actual/expected numeric line (e.g. "65/70")
                              used to live here. Removed to clean up the grid
                              — the cell background already conveys efficiency
                              (green/yellow/red), and the red ring + reason
                              dropdown signal sub-threshold + missing-reason. */}
                          {!noItem && !greyedOut &&
                            (() => {
                              const worked = workedMinutesForHour(entry.hour, hours);
                              if (worked >= 60) return null;
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
                          {reasonNeeded && !isLocked && (
                            <select
                              value={entry.reasonId ?? ""}
                              onChange={(e) => {
                                const v = e.target.value
                                  ? parseInt(e.target.value, 10)
                                  : null;
                                onReasonChange(rowIdx, hourIdx, v);
                              }}
                              className={`mt-1 w-full max-w-[110px] px-1 py-0.5 border rounded text-[10px] font-bold ${
                                missingReason
                                  ? "border-red-500 bg-red-100 text-red-800 ring-1 ring-red-400"
                                  : "border-input bg-white"
                              }`}
                              title={
                                missingReason
                                  ? "A reason is REQUIRED for this hour — save is blocked until you pick one"
                                  : "Reason"
                              }
                            >
                              <option value="">⚠ pick reason</option>
                              {reasons
                                .filter((r) => r.status === "active")
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </td>
                    );
                  }))}

                  <td className="px-2 py-0.5 text-right">
                    <span className="font-mono font-bold text-[11px]">
                      {isUnassigned ? "off" : totalActual > 0 ? totalActual : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-0.5 text-right">
                    {isUnassigned ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        idle
                      </span>
                    ) : (
                      <>
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
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

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
                const hourlyRows = rows.filter(
                  (r) => r.trackingMode !== "shift_total"
                );
                const allLocked =
                  hourlyRows.length > 0 &&
                  hourlyRows.every(
                    (r) => Array.isArray(r.lockedHours) && r.lockedHours.includes(i)
                  );
                const isSaving = savingHour === i;

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
                // Admin can undo any saved hour any time. Operator can only
                // undo until 5 min before the next hour ends (= hour label
                // + 55 min). Past that cutoff, only admin can undo.
                const operatorAllowed = operatorCanUndoByHour[i] ?? false;
                const canUndo = isAdmin || operatorAllowed;

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
                            : `Edit window closed — only admin can undo now`
                        }
                      >
                        <CheckCircle2 size={10} /> Saved
                      </button>
                    ) : i > maxSavableHourIdx ? (
                      // Hour hasn't happened yet (or selected date is in the
                      // future). Hide the save button — operators shouldn't
                      // save a closing reading for an hour that hasn't ended.
                      <span className="text-[9px] text-muted-foreground italic">
                        —
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
          )}
        </table>
      </div>
    </div>
  );
}

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
      placeholder=""
      min={0}
    />
  );
}
