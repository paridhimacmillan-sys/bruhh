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
import EntryGrid from "@/components/EntryGrid";

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
    setRows(buildRows(machines, items, hours, entries));
  }, [machines, items, hours, entries]);

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

    // Build carry map: (machineId-itemId) → last non-null closing, falling back to opening
    const carryMap = new Map<string, number>();
    for (const e of yesterdaysEntries) {
      const list = (e.entries as Array<{ closingReading: number | null }>) ?? [];
      let lastClosing: number | null = null;
      for (const h of list) {
        if (h.closingReading != null) lastClosing = h.closingReading;
      }
      const fallback = e.openingReading ?? 0;
      const value = lastClosing ?? (fallback > 0 ? fallback : null);
      if (value != null && e.itemId != null) {
        carryMap.set(`${e.machineId}-${e.itemId}`, value);
      }
    }

    if (carryMap.size === 0) {
      toast.error(`No usable readings found in ${prevDate}'s entries`);
      return;
    }

    let appliedCount = 0;
    setRows((prev) =>
      prev.map((r) => {
        const carried = carryMap.get(`${r.machineId}-${r.itemId}`);
        if (carried == null) return r;
        appliedCount++;
        return {
          ...r,
          openingReading: carried,
          entries: recomputeActuals(carried, r.entries),
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

  const saveAll = async (): Promise<{ ok: number; failed: number }> => {
    savingRef.current = true;
    let ok = 0;
    let failed = 0;
    try {
      for (const row of rowsRef.current) {
        // Skip rows that have no data at all
        if (
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
      const { ok, failed } = await saveAll();
      if (ok > 0 && failed === 0) {
        setLastSavedAt(Date.now());
        // Clear dirty flag locally
        setRows((prev) => prev.map((r) => ({ ...r, dirty: false })));
        // Don't immediately refetch — server roundtrip would clobber any
        // typing-in-progress. The next manual save/refresh will reconcile.
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

  const handleSaveHour = async (hourIdx: number) => {
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
          if (
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
      const { ok, failed } = await saveAll();
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
      await saveAll();
    }
    setShiftName(s);
  };

  const handleDateChange = async (d: string) => {
    if (d === date) return;
    if (rows.some((r) => r.dirty)) {
      await saveAll();
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
        savingHour={savingHour}
        onOpeningChange={handleOpeningChange}
        onClosingChange={handleClosingChange}
        onOperatorChange={handleOperatorChange}
        onSaveHour={handleSaveHour}
      />
    </div>
  );
}
