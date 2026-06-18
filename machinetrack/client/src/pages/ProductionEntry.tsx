import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import type {
  Machine,
  Item,
  Shift,
  Operator,
  ProductionEntry,
  BreakdownReason,
  MachineShift,
  ItemRate,
} from "@shared/schema";
import { useMe } from "@/hooks/useMe";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import {
  buildRows,
  computeShiftHours,
  recomputeActuals,
  expectedForHour,
  maxAllowedForHour,
  type GridRow,
} from "@/lib/productionGrid";
import EntryGrid, { REASON_THRESHOLD_PCT } from "@/components/EntryGrid";

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatTimeHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ProductionEntryPage() {
  const { user } = useMe();
  const isAdmin = user?.role === "admin";

  const [date, setDate] = useState<string>(todayYMD());
  const [shiftName, setShiftName] = useState<string>("");
  const [rows, setRows] = useState<GridRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingHour, setSavingHour] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Whether the carry-forward "what to copy" picker is open
  const [carryPickerOpen, setCarryPickerOpen] = useState(false);
  // Split-row "from what hour" picker. Null = closed. Otherwise carries the
  // machineId we're splitting AND optionally a rowIdx if we're EDITING the
  // start hour of an existing row (admin click on chip).
  const [splitPicker, setSplitPicker] = useState<{
    mode: "new" | "edit";
    machineId: number;
    rowIdx?: number;
    currentHourIdx?: number;
  } | null>(null);

  // Refs to avoid stale closures in the debounced auto-save effect
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const { data: shifts = [] } = useQuery<Shift[]>({ queryKey: ["/api/shifts"] });
  const { data: operators = [] } = useQuery<Operator[]>({ queryKey: ["/api/operators"] });
  const { data: reasons = [] } = useQuery<BreakdownReason[]>({
    queryKey: ["/api/reasons"],
  });
  const { data: machineShifts = [] } = useQuery<MachineShift[]>({
    queryKey: ["/api/machine-shifts"],
  });

  // Pick a default shift the first time shifts load
  useEffect(() => {
    if (!shiftName && shifts.length > 0) setShiftName(shifts[0].name);
  }, [shifts, shiftName]);

  const currentShift = useMemo(
    () => shifts.find((s) => s.name === shiftName),
    [shifts, shiftName]
  );
  const hours = useMemo(
    () => (currentShift ? computeShiftHours(currentShift) : []),
    [currentShift]
  );

  // Ticks every minute so time-gated UI (the "Save HH:00" buttons) refreshes
  // without having to wait for unrelated state changes to trigger a render.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Highest hour-index that is "savable now": its end-time has been reached
  // on the wall clock. Operators can't save the closing for an hour that
  // hasn't happened yet (e.g. clicking "Save 16:00" at 15:00). Buttons for
  // future hours are hidden by EntryGrid.
  //
  // For past dates, every hour is savable (filling historical data). For
  // future dates, no hour is savable. For today, compare each hour's
  // absolute timestamp to `now`.
  const maxSavableHourIdx = useMemo(() => {
    if (!currentShift || hours.length === 0) return -1;
    // Past or future date checks first — short-circuit without time math.
    const today = todayYMD();
    if (date < today) return hours.length - 1; // all hours elapsed
    if (date > today) return -1; // nothing saveable yet
    // Today: build absolute timestamps for each hour-end. The shift's hour
    // list already wraps midnight correctly (computeShiftHours produces
    // labels in chronological order), so we walk from shift start and add
    // 60 min per hour. We rebuild the chain from shift start to avoid
    // ambiguity when a label like "01:00" appears in a 21:00→08:00 shift.
    const [sH, sM] = currentShift.startTime.split(":").map(Number);
    const base = new Date(date + "T00:00:00");
    base.setHours(sH, sM, 0, 0);
    const startMs = base.getTime();
    const now = Date.now();
    let lastElapsed = -1;
    for (let i = 0; i < hours.length; i++) {
      // hour[i] ends at shift_start + (i+1) hours
      const hourEndMs = startMs + (i + 1) * 60 * 60 * 1000;
      if (now >= hourEndMs) lastElapsed = i;
      else break;
    }
    return lastElapsed;
    // nowTick included so this recomputes every minute as time passes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShift, hours, date, nowTick]);

  // For each hour index, whether an operator is still inside their edit
  // window. Operator window closes 5 min BEFORE the next hour ends —
  // equivalent to "hour label + 55 minutes". Past the cutoff, only admin
  // can undo. Admin is gated separately at the call site.
  //
  // Example: hour 14:00 (worked hour 13:00–14:00) — cutoff is 14:55.
  // If 14:00 was auto-saved at 14:15, operator can still edit/undo
  // until 14:55, giving them ~40 min to fix mistakes.
  //
  // For past dates (yesterday), every cutoff is in the past → operator
  // can't undo (admin only).
  // For future dates (shouldn't be entering data, but defensive), every
  // cutoff is in the future → operator allowed.
  const operatorCanUndoByHour = useMemo(() => {
    if (!currentShift || hours.length === 0) return [];
    const [sH, sM] = currentShift.startTime.split(":").map(Number);
    const base = new Date(date + "T00:00:00");
    base.setHours(sH, sM, 0, 0);
    const startMs = base.getTime();
    const now = Date.now();
    return hours.map((_, i) => {
      // cutoff = hour label time + 55 min
      //        = shift_start + (i+1)*60 min + 55 min
      const cutoffMs = startMs + ((i + 1) * 60 + 55) * 60 * 1000;
      return now < cutoffMs;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShift, hours, date, nowTick]);

  // Server-side entries for the current date+shift
  const entriesUrl = `/api/entries?dateFrom=${encodeURIComponent(
    date
  )}&dateTo=${encodeURIComponent(date)}&shift=${encodeURIComponent(shiftName)}`;
  const { data: entries = [], refetch: refetchEntries } = useQuery<ProductionEntry[]>({
    queryKey: [entriesUrl],
    enabled: !!shiftName,
  });

  // ALL entries for the selected date across ALL shifts. Used to figure out
  // which shifts already have data — so we can hide the other shift buttons
  // and prevent the operator from accidentally logging into a second shift
  // for the same date.
  const dateOnlyUrl = `/api/entries?dateFrom=${encodeURIComponent(
    date
  )}&dateTo=${encodeURIComponent(date)}`;
  const { data: allDateEntries = [] } = useQuery<ProductionEntry[]>({
    queryKey: [dateOnlyUrl],
    enabled: !!date,
  });

  // Set of shift names that have AT LEAST ONE saved entry for the date.
  const shiftsWithData = useMemo(() => {
    const set = new Set<string>();
    for (const e of allDateEntries) {
      // Only count entries with actual data — an empty placeholder (no
      // readings + no item) shouldn't lock the shift.
      const hasReading = Array.isArray(e.entries)
        ? (e.entries as Array<{ closingReading: number | null }>).some(
            (h) => h && h.closingReading != null
          )
        : false;
      const hasOpening = (e.openingReading ?? 0) > 0;
      if (hasReading || hasOpening) set.add(e.shift);
    }
    return set;
  }, [allDateEntries]);

  // Previous-day entries for the SAME shift, used for carry-forward prompt
  function prevDateYMD(d: string): string {
    const [y, m, day] = d.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, day));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
      dt.getUTCDate()
    ).padStart(2, "0")}`;
  }
  const prevDate = useMemo(() => prevDateYMD(date), [date]);
  const prevEntriesUrl = `/api/entries?dateFrom=${encodeURIComponent(
    prevDate
  )}&dateTo=${encodeURIComponent(prevDate)}&shift=${encodeURIComponent(shiftName)}`;
  const { data: prevEntries = [], isFetching: prevEntriesFetching } = useQuery<
    ProductionEntry[]
  >({
    queryKey: [prevEntriesUrl],
    enabled: !!shiftName,
  });

  // Track which (date, shift) combos we've already evaluated for carry-forward.
  // Once a key is here, the effect skips entirely — no more re-runs, no more logs.
  const promptedRef = useRef<Set<string>>(new Set());

  // Whenever the inputs (date/shift/machines/items/entries) change, rebuild the grid.
  // Skip rebuild while a save is in-flight to avoid clobbering optimistic local edits.
  const savingRef = useRef(false);
  useEffect(() => {
    if (savingRef.current) return;
    if (!hours.length) {
      setRows([]);
      return;
    }
    // Resolve the currently-selected shift name → shift id, so buildRows
    // can filter machines to only those assigned to this shift.
    const currentShift = shifts.find((s) => s.name === shiftName);
    const currentShiftId = currentShift?.id ?? null;
    setRows(
      buildRows(machines, items, hours, entries, currentShiftId, machineShifts)
    );
  }, [machines, items, hours, entries, shifts, shiftName, machineShifts]);

  // Manual carry-forward action: pull yesterday's last-hour closing readings and
  // pre-fill today's openings. User-triggered via a button so there's no race
  // condition with React Query loading state.
  // Carry forward behavior depends on what the user picked from the dialog:
  //   "part"          → only the item (so the row knows what's running today)
  //   "part_op"       → item + operator name (most common: same operator
  //                     continues today)
  //   "part_op_close" → item + operator + yesterday's closing becomes today's
  //                     opening reading (full continuation)
  type CarryMode = "part" | "part_op" | "part_op_close";

  const handleCarryForward = (mode: CarryMode) => {
    const matchesDate = (entryDate: unknown, targetYMD: string): boolean => {
      if (entryDate == null) return false;
      const s =
        typeof entryDate === "string"
          ? entryDate
          : entryDate instanceof Date
          ? entryDate.toISOString()
          : String(entryDate);
      return s.startsWith(targetYMD);
    };

    const yesterdaysEntries = prevEntries.filter((e) => matchesDate(e.date, prevDate));
    if (yesterdaysEntries.length === 0) {
      toast.error(`No entries found for ${prevDate} / Shift ${shiftName}`);
      return;
    }

    // For each machine on yesterday, find:
    //   - the LAST itemId it ran (presumed "current item")
    //   - the closing reading at end of that run
    //   - the operator name(s)
    // We use this to repopulate today's row(s) based on `mode`.
    type Carry = {
      itemId: number;
      value: number;
      operatorName: string;
      operatorName2: string;
      operatorChangeTime: string;
    };
    const carryByMachine = new Map<number, Carry>();
    for (const e of yesterdaysEntries) {
      if (e.itemId == null) continue;
      const list = (e.entries as Array<{ closingReading: number | null }>) ?? [];
      let lastClosing: number | null = null;
      for (const h of list) {
        if (h.closingReading != null) lastClosing = h.closingReading;
      }
      const fallback = e.openingReading ?? 0;
      const value = lastClosing ?? (fallback > 0 ? fallback : 0);
      // If multiple entries for same machine (shift split), the last one wins
      carryByMachine.set(e.machineId, {
        itemId: e.itemId,
        value,
        operatorName: e.operatorName ?? "",
        operatorName2: (e as any).operatorName2 ?? "",
        operatorChangeTime: (e as any).operatorChangeTime ?? "",
      });
    }

    if (carryByMachine.size === 0) {
      toast.error(`No items to carry forward from ${prevDate}`);
      return;
    }

    let appliedCount = 0;
    setRows((prev) =>
      prev.map((r) => {
        const carry = carryByMachine.get(r.machineId);
        if (!carry) return r;
        // If the row has no item picked yet, auto-pick yesterday's item
        // (looking it up in the items list to attach the item object + rate)
        let nextItem = r.item;
        let nextItemId = r.itemId;
        let nextExpected = r.expected;
        if (r.itemId == null) {
          const item = items.find((i) => i.id === carry.itemId) ?? null;
          if (item) {
            const rates = Array.isArray(item.rates)
              ? (item.rates as ItemRate[])
              : [];
            nextExpected =
              rates.find((rt) => rt?.machineId === r.machineId)?.rate ?? 0;
            nextItem = item;
            nextItemId = item.id;
          }
        } else if (r.itemId !== carry.itemId) {
          // Different item picked today — don't override their choice.
          // Skip the carry entirely (don't apply yesterday's reading
          // since it's for a different part).
          return r;
        }
        appliedCount++;
        const newEntries = r.entries.map((e) => ({
          ...e,
          expected: nextExpected,
        }));
        // Apply operator only for modes that include it. Don't overwrite
        // an already-picked operator today (operator might already be at
        // the machine and chosen themselves).
        const applyOp = mode === "part_op" || mode === "part_op_close";
        const applyClose = mode === "part_op_close";
        const nextOperator =
          applyOp && !r.operatorName ? carry.operatorName : r.operatorName;
        const nextOperator2 =
          applyOp && !r.operatorName2 ? carry.operatorName2 : r.operatorName2;
        const nextChangeTime =
          applyOp && !r.operatorChangeTime
            ? carry.operatorChangeTime
            : r.operatorChangeTime;
        const nextOpening = applyClose ? carry.value : r.openingReading;
        return {
          ...r,
          itemId: nextItemId,
          item: nextItem,
          expected: nextExpected,
          openingReading: nextOpening,
          operatorName: nextOperator,
          operatorName2: nextOperator2,
          operatorChangeTime: nextChangeTime,
          entries: recomputeActuals(nextOpening, newEntries),
          dirty: true,
        };
      })
    );

    const label =
      mode === "part"
        ? "items"
        : mode === "part_op"
        ? "items + operators"
        : "items + operators + opening readings";
    toast.success(
      `Carried forward ${label} for ${appliedCount} machine(s) from ${prevDate}`
    );
    setCarryPickerOpen(false);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Mutations
  // ──────────────────────────────────────────────────────────────────────────

  const saveRow = async (row: GridRow): Promise<void> => {
    const totalActual = row.entries.reduce((s, e) => s + e.actual, 0);
    const totalExpected = row.entries.reduce((s, e) => s + e.expected, 0);
    const body = {
      date,
      machineId: row.machineId,
      itemId: row.itemId,
      shift: shiftName,
      openingReading: row.openingReading,
      // Shift-total mode persists when opening/closing were clocked.
      // Server uses these to compute target. Send as ISO strings; null clears.
      openingAt: row.openingAt ? row.openingAt.toISOString() : null,
      closingAt: row.closingAt ? row.closingAt.toISOString() : null,
      // Hour at which this row started (split-row feature). null = ran from
      // shift start.
      startHourIdx: row.startHourIdx,
      entries: row.entries,
      operatorName: row.operatorName || null,
      operatorName2: row.operatorName2 || null,
      operatorChangeTime: row.operatorChangeTime || null,
      notes: row.notes || null,
      lockedHours: row.lockedHours,
      hourSavedAt: row.hourSavedAt,
      totalActual,
      totalExpected,
      status: "submitted",
    };
    await api("/api/entries", { method: "POST", body: JSON.stringify(body) });
  };

  const saveAll = async (
    opts: { silent?: boolean } = {}
  ): Promise<{ ok: number; failed: number; blocked?: boolean }> => {
    // Validate: any row with a sub-threshold cell that has a closing reading
    // MUST have a reason picked. Blocks save with a descriptive toast.
    // Unassigned-operator rows are EXCLUDED from this check — they're
    // considered idle and won't be saved anyway.
    const missing: string[] = [];
    for (const row of rowsRef.current) {
      if ((row.operatorName ?? "").trim() === "") continue;
      for (let i = 0; i < row.entries.length; i++) {
        const e = row.entries[i];
        if (e.closingReading == null || e.expected <= 0) continue;
        const pct = (e.actual / e.expected) * 100;
        if (pct < REASON_THRESHOLD_PCT && e.reasonId == null) {
          missing.push(`${row.machine.machineNumber} @ ${e.hour}`);
        }
      }
    }
    if (missing.length > 0) {
      const sample = missing.slice(0, 3).join(", ");
      const message = `Pick a reason for ${missing.length} hour cell${
        missing.length === 1 ? "" : "s"
      } below ${REASON_THRESHOLD_PCT}% efficiency: ${sample}${
        missing.length > 3 ? "..." : ""
      }`;
      if (!opts.silent) {
        toast.error(message, { duration: 6000 });
      } else {
        // Silent auto-save was blocked. Throttle to once per 30s so we
        // don't spam, but still tell the operator — otherwise they think
        // their data was saved when it wasn't.
        const now = Date.now();
        if (now - lastSilentReasonWarnRef.current > 30_000) {
          lastSilentReasonWarnRef.current = now;
          toast.warning(
            `Auto-save paused — ${message}`,
            { duration: 6000 }
          );
        }
      }
      return { ok: 0, failed: 0, blocked: true };
    }

    // Validate "both or neither" for second operator + change time
    const handoverIssues: string[] = [];
    for (const row of rowsRef.current) {
      const op2 = row.operatorName2.trim();
      const chg = row.operatorChangeTime.trim();
      if ((op2 && !chg) || (!op2 && chg)) {
        handoverIssues.push(row.machine.machineNumber);
      }
    }
    if (handoverIssues.length > 0) {
      const message = `Fill BOTH operator-2 name AND change time (or leave both blank): ${handoverIssues.join(", ")}`;
      if (!opts.silent) {
        toast.error(message, { duration: 6000 });
      } else {
        const now = Date.now();
        if (now - lastSilentReasonWarnRef.current > 30_000) {
          lastSilentReasonWarnRef.current = now;
          toast.warning(`Auto-save paused — ${message}`, { duration: 6000 });
        }
      }
      return { ok: 0, failed: 0, blocked: true };
    }

    savingRef.current = true;
    let ok = 0;
    let failed = 0;
    try {
      for (const row of rowsRef.current) {
        // Skip rows with no item picked yet
        if (row.itemId == null) continue;
        // Skip rows with no data AND no pending changes. A row with item
        // picked but no readings still needs to be saved if the user just
        // picked the item (dirty=true) so the choice persists.
        if (
          !row.dirty &&
          row.openingReading === 0 &&
          row.entries.every((e) => e.closingReading == null)
        ) {
          continue;
        }
        try {
          await saveRow(row);
          ok++;
        } catch (e: any) {
          failed++;
          toast.error(`${row.machine.machineNumber}: ${e.message ?? "save failed"}`);
        }
      }
    } finally {
      savingRef.current = false;
    }
    return { ok, failed };
  };

  // Debounced auto-save (1.5s after last change)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Last time we showed a "save blocked by missing reason" warning in silent
  // (auto-save) mode. Throttles to ~once per 30 seconds so we inform the
  // operator without spamming. Without this, silent-mode saves could fail
  // forever with no visible feedback when reasons are missing.
  const lastSilentReasonWarnRef = useRef<number>(0);
  useEffect(() => {
    const anyDirty = rows.some((r) => r.dirty);
    if (!anyDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      const { ok, failed, blocked } = await saveAll({ silent: true });
      if (blocked) {
        // Don't clear dirty — operator still needs to act — but don't keep
        // re-firing either. Wait for them to fix the missing reason.
        return;
      }
      if (ok > 0 && failed === 0) {
        setLastSavedAt(Date.now());
        setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, date, shiftName]);

  // ──────────────────────────────────────────────────────────────────────────
  // Handlers (always set dirty: true on changes)
  // ──────────────────────────────────────────────────────────────────────────

  const updateRow = (idx: number, mutate: (r: GridRow) => GridRow) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...mutate(next[idx]), dirty: true };
      return next;
    });
  };

  const handleOpeningChange = (idx: number, value: number) => {
    updateRow(idx, (r) => ({
      ...r,
      openingReading: Math.max(0, value),
      entries: recomputeActuals(Math.max(0, value), r.entries),
    }));
  };

  const handleClosingChange = (
    idx: number,
    hourIdx: number,
    value: number | null
  ) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[idx];

      // Clearing the cell: just remove and recompute. No validation needed.
      if (value == null) {
        const newEntries = [...row.entries];
        newEntries[hourIdx] = { ...newEntries[hourIdx], closingReading: null };
        next[idx] = {
          ...row,
          entries: recomputeActuals(row.openingReading, newEntries),
          dirty: true,
        };
        return next;
      }

      const expected = row.entries[hourIdx]?.expected ?? 0;

      // Validate: opening must be set
      if (row.openingReading === 0) {
        toast.error("Enter the opening reading first");
        return prev;
      }

      // "Previous reading" is the most recent non-null closing BEFORE this
      // hour. Skipped/gap hours are tolerated — meter doesn't move when no
      // production happens. Falls back to opening reading if nothing earlier
      // is set yet.
      let prevReading = row.openingReading;
      for (let i = hourIdx - 1; i >= 0; i--) {
        const c = row.entries[i].closingReading;
        if (c != null) {
          prevReading = c;
          break;
        }
      }

      // Validate: must not go backwards from the last real reading
      if (value < prevReading) {
        toast.error(
          `Closing (${value}) cannot be less than previous reading (${prevReading})`
        );
        return prev;
      }

      // Validate: must not exceed PHYSICAL max for this hour (allowing the
      // operator to work through tea/shift-edge breaks, but not through
      // lunch since that's a real clock gap). For most hours this equals
      // expected; for allowance hours it's the full-hour rate.
      const wouldBeActual = value - prevReading;
      const rowRate = row.expected; // row.expected is the hourly rate
      const physicalMax = maxAllowedForHour(rowRate, row.entries[hourIdx].hour, hours);
      if (physicalMax > 0 && wouldBeActual > physicalMax) {
        const maxClosing = prevReading + physicalMax;
        toast.error(
          `Output ${wouldBeActual} exceeds physical max ${physicalMax} for ${row.entries[hourIdx].hour}. Max closing: ${maxClosing}`
        );
        return prev;
      }

      const newEntries = [...row.entries];
      newEntries[hourIdx] = { ...newEntries[hourIdx], closingReading: value };
      next[idx] = {
        ...row,
        entries: recomputeActuals(row.openingReading, newEntries),
        dirty: true,
      };
      return next;
    });
  };

  const handleOperatorChange = (idx: number, name: string) => {
    updateRow(idx, (r) => ({ ...r, operatorName: name }));
  };

  // Second operator (handover mid-shift). Optional.
  const handleOperator2Change = (idx: number, name: string) => {
    updateRow(idx, (r) => ({ ...r, operatorName2: name }));
  };

  // Time at which the operator handover happened. "HH:MM".
  const handleOperatorChangeTimeChange = (idx: number, time: string) => {
    updateRow(idx, (r) => ({ ...r, operatorChangeTime: time }));
  };

  // Item picker: operator/admin chose a different item for this row.
  // Update the row's itemId, item ref, and recompute the per-hour `expected` rate
  // (from item.rates for this machine).
  const handleItemChange = (rowIdx: number, itemId: number | null) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      if (itemId == null) {
        next[rowIdx] = {
          ...row,
          itemId: null,
          item: null,
          expected: 0,
          entries: row.entries.map((e) => ({ ...e, expected: 0 })),
          dirty: true,
        };
        return next;
      }
      const item = items.find((i) => i.id === itemId);
      if (!item) return prev;
      const rates = Array.isArray(item.rates) ? (item.rates as ItemRate[]) : [];
      const rate = rates.find((r) => r?.machineId === row.machineId)?.rate ?? 0;
      next[rowIdx] = {
        ...row,
        itemId,
        item,
        expected: rate,
        entries: row.entries.map((e) => ({
          ...e,
          expected: expectedForHour(rate, e.hour, hours),
        })),
        dirty: true,
      };
      // Recompute actuals based on new expected rate
      next[rowIdx].entries = recomputeActuals(
        next[rowIdx].openingReading,
        next[rowIdx].entries
      );
      return next;
    });
  };

  // Split: open the "from what hour" picker so the operator can declare when
  // the new setting/item started running. The actual row creation happens
  // in confirmSplitWithStartHour once they pick an hour.
  const handleSplitRow = (machineId: number) => {
    // Reject early if the machine already has a row with no item picked —
    // they should fill that one first instead of stacking blanks.
    const hasBlank = rowsRef.current.some(
      (r) => r.machineId === machineId && r.itemId == null
    );
    if (hasBlank) {
      toast.error("Pick an item for the existing row first");
      return;
    }
    setSplitPicker({ mode: "new", machineId });
  };

  // Admin clicked the "from HH:MM" chip on a split row — reopen the picker
  // to edit. Does NOT create a new row; updates the existing row's
  // startHourIdx on confirm.
  const handleEditStartHour = (rowIdx: number) => {
    if (!isAdmin) return;
    const row = rowsRef.current[rowIdx];
    if (!row) return;
    setSplitPicker({
      mode: "edit",
      machineId: row.machineId,
      rowIdx,
      currentHourIdx: row.startHourIdx ?? 0,
    });
  };

  // Confirm the split picker. In "new" mode this creates the row with the
  // chosen startHourIdx. In "edit" mode it updates the existing row's
  // startHourIdx (admin only).
  const confirmSplitWithStartHour = (hourIdx: number) => {
    if (!splitPicker) return;

    if (splitPicker.mode === "edit" && splitPicker.rowIdx != null) {
      const rowIdx = splitPicker.rowIdx;
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = {
          ...next[rowIdx],
          startHourIdx: hourIdx,
          dirty: true,
        };
        return next;
      });
      toast.success(`Start time updated to ${hours[hourIdx]}`);
      setSplitPicker(null);
      return;
    }

    // "new" mode: create the split row with the picked startHourIdx
    const machineId = splitPicker.machineId;
    setRows((prev) => {
      const lastIdx = prev
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.machineId === machineId)
        .map(({ i }) => i)
        .pop();
      const machine = prev.find((r) => r.machineId === machineId)?.machine;
      if (!machine) return prev;
      const existingForMachine = prev.find((r) => r.machineId === machineId);
      const newRow: GridRow = {
        rowKey: `split-${machineId}-${Date.now()}`,
        machineId,
        machine,
        itemId: null,
        item: null,
        expected: 0,
        openingReading: 0,
        entries: hours.map((hour) => ({
          hour,
          closingReading: null,
          actual: 0,
          expected: 0,
        })),
        operatorName: "",
        operatorName2: "",
        operatorChangeTime: "",
        notes: "",
        lockedHours: [],
        hourSavedAt: {},
        trackingMode: existingForMachine?.trackingMode ?? "hourly",
        openingAt: null,
        closingAt: null,
        startHourIdx: hourIdx,
        dirty: false,
      };
      const insertAt = (lastIdx ?? prev.length - 1) + 1;
      const next = [...prev];
      next.splice(insertAt, 0, newRow);
      return next;
    });
    toast.success(`New row added starting at ${hours[hourIdx]}`);
    setSplitPicker(null);
  };

  // Delete a row from the grid. For unsaved rows (rowKey starts with "new-"
  // or "split-") just remove from local state. For saved rows (rowKey
  // "saved-<id>") also DELETE the production_entries row on the server.
  // Admin-only (the trash button is hidden for non-admins in EntryGrid).
  const handleDeleteRow = async (rowIdx: number) => {
    const row = rowsRef.current[rowIdx];
    if (!row) return;

    const isSaved = row.rowKey.startsWith("saved-");
    const label = row.item?.itemName
      ? `${row.machine.machineNumber} — ${row.item.itemName}`
      : `${row.machine.machineNumber} (empty row)`;

    if (
      !confirm(
        isSaved
          ? `Delete saved entry for ${label}? This permanently removes the readings for this row.`
          : `Remove ${label} row?`
      )
    ) {
      return;
    }

    // Remove from local state first for snappy UI
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));

    if (isSaved) {
      const entryId = parseInt(row.rowKey.replace("saved-", ""), 10);
      try {
        await api(`/api/entries/${entryId}`, { method: "DELETE" });
        toast.success(`Removed ${label}`);
        // Refetch so server-side state is the source of truth
        await refetchEntries();
      } catch (e: any) {
        toast.error(`Failed to delete: ${e.message ?? "server error"}`);
        // Server state still has it — refetch will restore the row on next rebuild
        await refetchEntries();
      }
    } else {
      toast.success(`Removed ${label}`);
    }
  };

  // Reason chosen for a specific hour cell. NULL means "cleared".
  // Stored inside the row's entries[hourIdx].reasonId — auto-save picks it up.
  const handleReasonChange = (
    rowIdx: number,
    hourIdx: number,
    reasonId: number | null
  ) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[rowIdx];
      const newEntries = [...row.entries];
      newEntries[hourIdx] = { ...newEntries[hourIdx], reasonId };
      next[rowIdx] = { ...row, entries: newEntries, dirty: true };
      return next;
    });
  };

  const handleSaveHour = async (hourIdx: number) => {
    // Validate: every row that has data for THIS hour and is sub-threshold
    // must have a reason picked before locking the hour.
    // Unassigned-operator rows are skipped.
    const missing: string[] = [];
    for (const row of rows) {
      if ((row.operatorName ?? "").trim() === "") continue;
      const e = row.entries[hourIdx];
      if (!e || e.closingReading == null || e.expected <= 0) continue;
      const pct = (e.actual / e.expected) * 100;
      if (pct < REASON_THRESHOLD_PCT && e.reasonId == null) {
        missing.push(row.machine.machineNumber);
      }
    }
    if (missing.length > 0) {
      toast.error(
        `Pick a reason for ${hours[hourIdx]}: ${missing.join(", ")} — efficiency below ${REASON_THRESHOLD_PCT}%`,
        { duration: 5000 }
      );
      return;
    }

    setSavingHour(hourIdx);
    try {
      // Lock this hour on every row that has data for it, then save all rows.
      // Stamp the current time as the hourSavedAt for this hourIdx so the
      // undo logic can enforce the 10-min window.
      const nowIso = new Date().toISOString();
      const rowsWithLock = rows.map((r) => ({
        ...r,
        lockedHours: r.lockedHours.includes(hourIdx)
          ? r.lockedHours
          : [...r.lockedHours, hourIdx].sort((a, b) => a - b),
        hourSavedAt: { ...r.hourSavedAt, [String(hourIdx)]: nowIso },
        dirty: true,
      }));
      setRows(rowsWithLock);
      // Use the locked rows directly via ref-style trick
      savingRef.current = true;
      try {
        for (const row of rowsWithLock) {
          if (row.itemId == null) continue;
          if (
            !row.dirty &&
            row.openingReading === 0 &&
            row.entries.every((e) => e.closingReading == null)
          ) {
            continue;
          }
          await saveRow(row);
        }
      } finally {
        savingRef.current = false;
      }
      setLastSavedAt(Date.now());
      setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
      toast.success(`Hour ${hours[hourIdx]} saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSavingHour(null);
    }
  };

  // Undo a locked hour. Server enforces the rule: admin always, operator only
  // if it was saved less than 10 minutes ago. We also do a client-side check
  // first for an instant error message; server is the source of truth.
  const handleUnlockHour = async (hourIdx: number) => {
    // Find the earliest saved-at across all rows for this hour
    let earliest: number | null = null;
    for (const r of rows) {
      const t = r.hourSavedAt?.[String(hourIdx)];
      if (t) {
        const ms = new Date(t).getTime();
        if (earliest == null || ms < earliest) earliest = ms;
      }
    }

    if (!isAdmin) {
      if (earliest == null) {
        toast.error("No save timestamp on record — ask admin to undo");
        return;
      }
      const ageMin = (Date.now() - earliest) / 60000;
      if (ageMin > 10) {
        toast.error(
          `Saved ${Math.round(ageMin)} min ago — only admin can undo after 10 minutes`
        );
        return;
      }
    }

    const ageText =
      earliest != null
        ? ` (saved ${Math.round((Date.now() - earliest) / 60000)} min ago)`
        : "";
    if (
      !confirm(
        `Undo save for ${hours[hourIdx]}${ageText}? You'll be able to edit those closing readings again.`
      )
    ) {
      return;
    }

    try {
      await api("/api/entries/unlock-hour", {
        method: "POST",
        body: JSON.stringify({ date, shift: shiftName, hourIdx }),
      });
      toast.success(`Hour ${hours[hourIdx]} unlocked`);
      await refetchEntries();
    } catch (e: any) {
      toast.error(e.message ?? "Unlock failed");
    }
  };

  // SHIFT-TOTAL MODE HANDLERS
  // For machines configured as 'shift_total' in masters, the operator clicks
  // "Save Opening" at shift start (stamps openingAt) and "Save Closing" at
  // shift end (stamps closingAt). Server computes target from elapsed time.
  //
  // Both actions trigger an immediate save so the timestamps persist even
  // if the operator's network drops before they tab out of the cell.
  const handleSaveOpening = async (rowIdx: number) => {
    const row = rowsRef.current[rowIdx];
    if (!row) return;
    if (row.itemId == null) {
      toast.error("Pick an item first");
      return;
    }
    if (row.openingReading <= 0) {
      toast.error("Enter the opening meter reading first");
      return;
    }
    const now = new Date();
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], openingAt: now, dirty: true };
      return next;
    });
    try {
      await saveRow({ ...row, openingAt: now });
      toast.success(`Opening clocked @ ${formatTimeHHMM(now)}`);
      await refetchEntries();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const handleSaveClosing = async (rowIdx: number) => {
    const row = rowsRef.current[rowIdx];
    if (!row) return;
    if (!row.openingAt) {
      toast.error("Click Save Opening first");
      return;
    }
    // Find the entry the closing reading goes into. For shift-total mode the
    // grid renders a single cell — we use the LAST entry slot to store the
    // closing reading so the existing entries[] structure still works.
    const lastIdx = row.entries.length - 1;
    const lastEntry = row.entries[lastIdx];
    if (lastEntry.closingReading == null || lastEntry.closingReading <= 0) {
      toast.error("Enter the closing meter reading first");
      return;
    }
    const now = new Date();
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], closingAt: now, dirty: true };
      return next;
    });
    try {
      await saveRow({ ...row, closingAt: now });
      toast.success(`Closing clocked @ ${formatTimeHHMM(now)}`);
      await refetchEntries();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      const { ok, failed, blocked } = await saveAll();
      if (blocked) return; // validator already toasted
      if (failed === 0) {
        setLastSavedAt(Date.now());
        setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
        toast.success(`${ok} row(s) saved`);
        // Reconcile with server now that we're idle
        await refetchEntries();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete all entries for ${date} / shift ${shiftName}?`)) return;
    try {
      await api(
        `/api/entries?date=${encodeURIComponent(date)}&shift=${encodeURIComponent(
          shiftName
        )}`,
        { method: "DELETE" }
      );
      toast.success("Entries deleted");
      await queryClient.invalidateQueries({ queryKey: [entriesUrl] });
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  };

  // Auto-save before switching shift/date
  const handleShiftChange = async (s: string) => {
    if (s === shiftName) return;
    if (rows.some((r) => r.dirty)) {
      const { blocked } = await saveAll();
      if (blocked) return; // stay on this shift until reasons are filled
    }
    setShiftName(s);
  };

  const handleDateChange = async (d: string) => {
    if (d === date) return;
    if (rows.some((r) => r.dirty)) {
      const { blocked } = await saveAll();
      if (blocked) return;
    }
    setDate(d);
  };

  // Auto-save an hour when it's been ≥ 15 minutes since the slot ended AND
  // every row with an item picked has a closing reading for that hour AND
  // it's not already locked. Only runs when we're looking at today's date
  // (yesterday's grid shouldn't trigger from today's clock).
  // Polls every 60 seconds.
  // Unassigned-operator rows are NOT considered "active" — they're idle.
  const handleSaveHourRef = useRef(handleSaveHour);
  useEffect(() => {
    handleSaveHourRef.current = handleSaveHour;
  }, [handleSaveHour]);

  useEffect(() => {
    if (date !== todayYMD()) return;
    if (rows.length === 0) return;
    const AUTO_SAVE_DELAY_MIN = 15;

    const tick = () => {
      const now = new Date();
      for (let hourIdx = 0; hourIdx < hours.length; hourIdx++) {
        const label = hours[hourIdx];
        const [h, m] = label.split(":").map(Number);
        // Hour cell at "10:00" should auto-save at wall-clock 10:15.
        // Build a Date for the label, then check minutes since.
        const slotEnd = new Date(now);
        slotEnd.setHours(h, m, 0, 0);
        const minSince = (now.getTime() - slotEnd.getTime()) / 60000;
        if (minSince < AUTO_SAVE_DELAY_MIN) continue;

        // Already locked on every row that has data? Skip.
        const alreadyLocked = rows.every(
          (r) =>
            r.itemId == null ||
            (r.operatorName ?? "").trim() === "" ||
            (Array.isArray(r.lockedHours) && r.lockedHours.includes(hourIdx))
        );
        if (alreadyLocked) continue;

        // Only auto-save if at least one row is active (has an item picked
        // AND an operator assigned). If every row is idle there's nothing
        // worth saving for this hour.
        //
        // Gaps in closing readings are NO LONGER a blocker. The server
        // treats null closing readings as "skipped" (meter doesn't
        // advance), and operators can fill them in later if needed.
        // Previously we warned and refused to auto-save in that case;
        // now we just commit whatever's there.
        const activeRows = rows.filter(
          (r) => r.itemId != null && (r.operatorName ?? "").trim() !== ""
        );
        if (activeRows.length === 0) continue;

        // Silent pre-check for handleSaveHour's reason-required rule. If any
        // active row has a closing reading at this hour below threshold AND
        // no reason picked, handleSaveHour will toast.error and return —
        // which would spam every 60s. So we detect the same condition here
        // and skip auto-save for this slot, warning the operator once.
        const needsReason = activeRows.some((row) => {
          const e = row.entries[hourIdx];
          if (!e || e.closingReading == null || e.expected <= 0) return false;
          const pct = (e.actual / e.expected) * 100;
          return pct < REASON_THRESHOLD_PCT && e.reasonId == null;
        });
        if (needsReason) {
          if (!autoSaveWarnedRef.current.has(hourIdx)) {
            const machines = activeRows
              .filter((row) => {
                const e = row.entries[hourIdx];
                if (!e || e.closingReading == null || e.expected <= 0)
                  return false;
                const pct = (e.actual / e.expected) * 100;
                return pct < REASON_THRESHOLD_PCT && e.reasonId == null;
              })
              .map((r) => r.machine.machineNumber);
            toast.warning(
              `Auto-save waiting for reasons at ${label}: ${machines
                .slice(0, 4)
                .join(", ")}${machines.length > 4 ? "…" : ""}`,
              { duration: 6000 }
            );
            autoSaveWarnedRef.current.add(hourIdx);
          }
          continue;
        }

        // Trigger the same save flow as a manual click. Fire-and-forget.
        handleSaveHourRef.current(hourIdx);
        // Save one slot per tick to avoid hammering the server
        return;
      }
    };

    // Run once immediately, then every 60s
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [date, rows, hours]);

  // Tracks which auto-save warnings have already been shown this session.
  const autoSaveWarnedRef = useRef(new Set<number>());
  // Reset warning memory when shift/date changes
  useEffect(() => {
    autoSaveWarnedRef.current = new Set();
  }, [date, shiftName]);

  // KPIs. An "unassigned" operator (empty operatorName) means the machine
  // wasn't running that day, so we skip those rows entirely from page totals
  // and efficiency — counting them would always show 0% and drag the average
  // down for no reason.
  const activeRows = rows.filter((r) => (r.operatorName ?? "").trim() !== "");
  const totalActual = activeRows.reduce(
    (s, r) => s + r.entries.reduce((ss, e) => ss + e.actual, 0),
    0
  );
  const totalExpected = activeRows.reduce(
    (s, r) => s + r.entries.reduce((ss, e) => ss + e.expected, 0),
    0
  );
  const efficiency = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;
  const anyDirty = rows.some((r) => r.dirty);
  const hasData = rows.some(
    (r) => r.openingReading > 0 || r.entries.some((e) => e.closingReading != null)
  );

  if (shifts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Production Entry</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm">
          No shifts configured. Add shifts in <strong>Masters Management</strong> to start
          logging production.
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <header className="flex items-center justify-between">
        <h1 className="text-base font-bold">Production Entry</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={!hasData}
              title={hasData ? "Delete all entries for this date and shift" : "No entries to delete"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-destructive/30 text-destructive rounded hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-60 min-w-[90px] justify-center"
          >
            <Save size={12} />
            {saving ? "Saving…" : "Save Entries"}
          </button>
        </div>
      </header>

      <div className="bg-card border rounded-lg p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start">
          <div>
            <label className="block text-xs font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-2 py-1 border rounded text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => setCarryPickerOpen(true)}
              className="block mt-1 text-[10px] text-primary hover:underline"
              title={`Pre-fill from ${prevDate}`}
            >
              ← Carry forward from {prevDate}
            </button>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">
              Shift
              {shiftsWithData.size > 0 && (
                <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                  (other shifts hidden — already saved data for {Array.from(shiftsWithData).join(", ")})
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-1">
              {shifts
                .filter((s) => {
                  // If no shift has data yet, show all. Otherwise, show only
                  // the shift(s) that already have data — operators can't
                  // accidentally start a second shift on the same date.
                  if (shiftsWithData.size === 0) return true;
                  return shiftsWithData.has(s.name);
                })
                .map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleShiftChange(s.name)}
                  className={`px-2 py-1 text-xs rounded font-semibold leading-tight ${
                    s.name === shiftName
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  Shift {s.name}
                  <span className="block text-[9px] font-normal opacity-80 font-mono">
                    {s.startTime}-{s.endTime}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground leading-none">Total Actual</p>
            <p className="text-lg font-bold font-mono leading-tight">{totalActual.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground leading-none">
              Efficiency:{" "}
              <span
                className={`font-mono font-semibold ${
                  efficiency >= 95
                    ? "text-green-600"
                    : efficiency >= 80
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {efficiency}%
              </span>
            </p>
            {anyDirty ? (
              <p className="text-[10px] text-amber-600 font-medium leading-none mt-0.5">● Unsaved</p>
            ) : lastSavedAt ? (
              <p className="text-[10px] text-green-600 leading-none mt-0.5">
                ✓ Saved {Math.round((Date.now() - lastSavedAt) / 1000)}s ago
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <EntryGrid
        rows={rows}
        hours={hours}
        shift={shiftName}
        isAdmin={isAdmin}
        operators={operators}
        reasons={reasons}
        items={items}
        savingHour={savingHour}
        onItemChange={handleItemChange}
        onOpeningChange={handleOpeningChange}
        onClosingChange={handleClosingChange}
        onOperatorChange={handleOperatorChange}
        onOperator2Change={handleOperator2Change}
        onOperatorChangeTimeChange={handleOperatorChangeTimeChange}
        onReasonChange={handleReasonChange}
        onSplitRow={handleSplitRow}
        onDeleteRow={handleDeleteRow}
        onSaveHour={handleSaveHour}
        onUnlockHour={handleUnlockHour}
        onSaveOpening={handleSaveOpening}
        onSaveClosing={handleSaveClosing}
        onEditStartHour={handleEditStartHour}
        maxSavableHourIdx={maxSavableHourIdx}
        operatorCanUndoByHour={operatorCanUndoByHour}
      />

      {/* Carry-forward picker. Modal-style overlay with three options.
          The actual logic lives in handleCarryForward(mode) above. */}
      {carryPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCarryPickerOpen(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-5 w-[420px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-base mb-1">
              Carry forward from {prevDate}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Choose what to copy into today's grid. You can still edit
              anything afterwards.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleCarryForward("part")}
                className="w-full text-left px-3 py-2 border rounded hover:bg-muted/40"
              >
                <p className="text-sm font-semibold">Items only</p>
                <p className="text-[11px] text-muted-foreground">
                  Pre-fill which item each machine is running. Operator and
                  opening readings stay blank.
                </p>
              </button>
              <button
                onClick={() => handleCarryForward("part_op")}
                className="w-full text-left px-3 py-2 border rounded hover:bg-muted/40"
              >
                <p className="text-sm font-semibold">Items + Operators</p>
                <p className="text-[11px] text-muted-foreground">
                  Pre-fill items and operator names (including handover, if
                  any). Opening readings stay blank.
                </p>
              </button>
              <button
                onClick={() => handleCarryForward("part_op_close")}
                className="w-full text-left px-3 py-2 border rounded hover:bg-muted/40"
              >
                <p className="text-sm font-semibold">
                  Items + Operators + Opening (last closing → today's opening)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Full continuation. Yesterday's last closing reading becomes
                  today's opening for each machine.
                </p>
              </button>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setCarryPickerOpen(false)}
                className="px-3 py-1 text-xs border rounded hover:bg-muted/40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Split-row "from what hour" picker. Opens on "+ Split" click
          (mode=new, creates a row) OR on admin chip-click (mode=edit,
          updates existing row's startHourIdx). 3-column grid of the
          shift's hour labels — picking one fires confirmSplitWithStartHour. */}
      {splitPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSplitPicker(null)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-5 w-[360px] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-base mb-1">
              {splitPicker.mode === "edit" ? "Edit start hour" : "New setting started at"}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {splitPicker.mode === "edit"
                ? "Change the hour this row started running. Cells outside the new window will be greyed."
                : "Pick the hour the new item/setting started. Cells before it will be greyed on this new row, and cells from this hour onwards will be greyed on the previous row."}
            </p>
            <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
              {hours.map((h, idx) => {
                const isCurrent =
                  splitPicker.mode === "edit" &&
                  splitPicker.currentHourIdx === idx;
                return (
                  <button
                    key={`pick-${idx}`}
                    onClick={() => confirmSplitWithStartHour(idx)}
                    className={`px-2 py-1.5 border rounded font-mono text-xs ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setSplitPicker(null)}
                className="px-3 py-1 text-xs border rounded hover:bg-muted/40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
