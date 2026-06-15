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
  type GridRow,
} from "@/lib/productionGrid";
import EntryGrid, { REASON_THRESHOLD_PCT } from "@/components/EntryGrid";

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

  // Server-side entries for the current date+shift
  const entriesUrl = `/api/entries?dateFrom=${encodeURIComponent(
    date
  )}&dateTo=${encodeURIComponent(date)}&shift=${encodeURIComponent(shiftName)}`;
  const { data: entries = [], refetch: refetchEntries } = useQuery<ProductionEntry[]>({
    queryKey: [entriesUrl],
    enabled: !!shiftName,
  });

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
  const handleCarryForward = () => {
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
    // We'll use this to both auto-pick the item AND seed the opening.
    type Carry = { itemId: number; value: number };
    const carryByMachine = new Map<number, Carry>();
    for (const e of yesterdaysEntries) {
      if (e.itemId == null) continue;
      const list = (e.entries as Array<{ closingReading: number | null }>) ?? [];
      let lastClosing: number | null = null;
      for (const h of list) {
        if (h.closingReading != null) lastClosing = h.closingReading;
      }
      const fallback = e.openingReading ?? 0;
      const value = lastClosing ?? (fallback > 0 ? fallback : null);
      if (value == null) continue;
      // If multiple entries for same machine (shift split), the last one wins
      carryByMachine.set(e.machineId, { itemId: e.itemId, value });
    }

    if (carryByMachine.size === 0) {
      toast.error(`No usable readings found in ${prevDate}'s entries`);
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
        return {
          ...r,
          itemId: nextItemId,
          item: nextItem,
          expected: nextExpected,
          openingReading: carry.value,
          entries: recomputeActuals(carry.value, newEntries),
          dirty: true,
        };
      })
    );

    toast.success(`Carried forward ${appliedCount} opening reading(s) from ${prevDate}`);
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
      entries: row.entries,
      operatorName: row.operatorName || null,
      notes: row.notes || null,
      lockedHours: row.lockedHours,
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
    const missing: string[] = [];
    for (const row of rowsRef.current) {
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
      if (!opts.silent) {
        const sample = missing.slice(0, 3).join(", ");
        toast.error(
          `Pick a reason for ${missing.length} hour cell${
            missing.length === 1 ? "" : "s"
          } below ${REASON_THRESHOLD_PCT}% efficiency: ${sample}${
            missing.length > 3 ? "..." : ""
          }`,
          { duration: 6000 }
        );
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

  const handleClosingChange = (idx: number, hourIdx: number, value: number) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[idx];
      const expected = row.entries[hourIdx]?.expected ?? 0;

      // Validate: opening must be set
      if (row.openingReading === 0) {
        toast.error("Enter the opening reading first");
        return prev;
      }

      // Validate: previous hours must be entered before this one
      for (let i = 0; i < hourIdx; i++) {
        if (row.entries[i].closingReading == null) {
          toast.error(`Enter hour ${row.entries[i].hour} first`);
          return prev;
        }
      }

      const prevReading =
        hourIdx === 0
          ? row.openingReading
          : row.entries[hourIdx - 1].closingReading ?? row.openingReading;

      // Validate: must not go backwards
      if (value < prevReading) {
        toast.error(
          `Closing (${value}) cannot be less than previous reading (${prevReading})`
        );
        return prev;
      }

      // Validate: must not exceed target
      const wouldBeActual = value - prevReading;
      if (expected > 0 && wouldBeActual > expected) {
        const maxClosing = prevReading + expected;
        toast.error(
          `Output ${wouldBeActual} exceeds target ${expected}. Max closing: ${maxClosing}`
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
        entries: row.entries.map((e) => ({ ...e, expected: rate })),
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

  // Split: add a new empty row for the given machine so the operator can log
  // a second item run later in the shift. The new row goes right after the
  // last existing row for that machine.
  const handleSplitRow = (machineId: number) => {
    setRows((prev) => {
      // Reject if the machine already has a row with no item picked — they
      // should fill that one first instead of stacking blanks.
      const hasBlank = prev.some(
        (r) => r.machineId === machineId && r.itemId == null
      );
      if (hasBlank) {
        toast.error("Pick an item for the existing row first");
        return prev;
      }
      const lastIdx = prev
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.machineId === machineId)
        .map(({ i }) => i)
        .pop();
      const machine = prev.find((r) => r.machineId === machineId)?.machine;
      if (!machine) return prev;
      // Use a unique synthetic key so React doesn't reuse fiber state
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
        notes: "",
        lockedHours: [],
        dirty: false,
      };
      const insertAt = (lastIdx ?? prev.length - 1) + 1;
      const next = [...prev];
      next.splice(insertAt, 0, newRow);
      return next;
    });
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
    const missing: string[] = [];
    for (const row of rows) {
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
      // Lock this hour on every row that has data for it, then save all rows
      const rowsWithLock = rows.map((r) => ({
        ...r,
        lockedHours: r.lockedHours.includes(hourIdx)
          ? r.lockedHours
          : [...r.lockedHours, hourIdx].sort((a, b) => a - b),
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

  // KPIs
  const totalActual = rows.reduce(
    (s, r) => s + r.entries.reduce((ss, e) => ss + e.actual, 0),
    0
  );
  const totalExpected = rows.reduce(
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
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Entry</h1>
          <p className="text-sm text-muted-foreground">
            Log hourly meter readings. App computes actual vs target.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={!hasData}
              title={hasData ? "Delete all entries for this date and shift" : "No entries to delete"}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-destructive/30 text-destructive rounded hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-60 min-w-[110px] justify-center"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save Entries"}
          </button>
        </div>
      </header>

      <div className="bg-card border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <div>
            <label className="block text-xs font-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 border rounded text-sm font-mono"
            />
            <button
              type="button"
              onClick={handleCarryForward}
              className="block mt-2 text-xs text-primary hover:underline"
              title={`Pre-fill openings from ${prevDate}`}
            >
              ← Carry forward from {prevDate}
            </button>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Shift</label>
            <div className="flex flex-wrap gap-2">
              {shifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleShiftChange(s.name)}
                  className={`px-3 py-2 text-sm rounded font-semibold ${
                    s.name === shiftName
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  Shift {s.name}
                  <span className="block text-[10px] font-normal opacity-80 font-mono">
                    {s.startTime}-{s.endTime}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="text-2xl font-bold font-mono">{totalActual.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
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
              <p className="text-xs text-amber-600 font-medium mt-1">● Unsaved changes</p>
            ) : lastSavedAt ? (
              <p className="text-xs text-green-600 mt-1">
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
        onReasonChange={handleReasonChange}
        onSplitRow={handleSplitRow}
        onSaveHour={handleSaveHour}
      />
    </div>
  );
}
