'use client';
import React, { useState, useEffect } from 'react';
import { Copy, Upload, Save, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EntryGrid from './EntryGrid';
import ImportModal from './ImportModal';
import CopyPreviousModal from './CopyPreviousModal';
import { HourlyEntry, ProductionEntry } from '@/lib/mockData';
import { getMachines, getItems, getEntries, upsertEntries, subscribe, setHasUnsavedDraft } from '@/lib/store';
import { getShiftHours, getShifts, subscribeShifts } from '@/lib/shifts';
import { getTodayISOLocal } from '@/lib/date';
import { useAccess } from '@/lib/useAccess';

type Shift = string;

export interface GridRow {
  machineId: string;
  itemId: string;
  openingReading: number;
  entries: HourlyEntry[];
  status: 'draft' | 'submitted' | 'flagged';
  operatorName: string;
  notes: string;
}

function recalculateEntriesFromReadings(openingReading: number, entries: HourlyEntry[]): HourlyEntry[] {
  let previous = Number(openingReading) || 0;
  return entries.map((e) => {
    const closing = e.closingReading;
    if (closing === null || closing === undefined || Number.isNaN(Number(closing))) {
      return { ...e, actual: 0, closingReading: null };
    }
    const closeVal = Number(closing);
    const actual = Math.max(0, closeVal - previous);
    previous = closeVal;
    return { ...e, actual, closingReading: closeVal };
  });
}

function splitExpectedAcrossHours(totalExpected: number, hourCount: number): number[] {
  if (hourCount <= 0) return [];
  const safeTotal = Math.max(0, Math.round(totalExpected));
  const base = Math.floor(safeTotal / hourCount);
  const remainder = safeTotal % hourCount;
  return Array.from({ length: hourCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

function getCarryForwardExpected(
  entries: ProductionEntry[],
  date: string,
  machineId: string,
  shift: Shift,
  fallbackPerHour: number,
  hourCount: number
): number[] {
  const previous = entries
    .filter((e) => e.machineId === machineId && e.shift === shift && e.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!previous) {
    return Array.from({ length: hourCount }, () => Math.max(1, Math.round(fallbackPerHour)));
  }
  const previousExpected = Math.max(
    0,
    previous.totalExpected || previous.entries.reduce((s, e) => s + (e.expected ?? 0), 0)
  );
  const previousActual = Math.max(
    0,
    previous.totalActual || previous.entries.reduce((s, e) => s + (e.actual ?? 0), 0)
  );
  const nextTotalExpected =
    previousActual > previousExpected
      ? Math.round((previousExpected + previousActual) / 2)
      : previousExpected;
  return splitExpectedAcrossHours(nextTotalExpected, hourCount);
}

function buildInitialRows(date: string, shift: Shift): { rows: GridRow[]; lockedHours: number[] } {
  if (!shift) return { rows: [], lockedHours: [] };
  const machines = getMachines();
  const items = getItems();
  const entries = getEntries();
  const activeMachines = machines.filter((m) => m.status !== 'offline');
  let lockedHours: number[] = [];
  const rows = activeMachines.map((machine) => {
    const existing = entries.find(
      (e) => e.date === date && e.machineId === machine.id && e.shift === shift
    );
    if (existing?.lockedHours?.length) {
      lockedHours = Array.from(new Set([...lockedHours, ...existing.lockedHours]));
    }
    const itemId =
      machine.currentItem ??
      (items.find((i) => i.status === 'active')?.id ?? items[0]?.id ?? '');
    const item = items.find((candidate) => candidate.id === itemId);
    const machineSpecificRate = item?.rates.find(
      (override) => override.machineId === machine.id
    )?.rate;
    const rate = Number(
      machineSpecificRate ?? item?.defaultRate ?? machine.expectedPerHour ?? 0
    );
    const hourCount = getShiftHours(shift).length;
    return {
      machineId: machine.id,
      itemId,
      openingReading: Number(existing?.openingReading ?? 0),
      entries: existing
        ? recalculateEntriesFromReadings(
            Number(existing?.openingReading ?? 0),
            Array.from({ length: hourCount }, (_, index) => {
              const entry = existing.entries[index];
              return {
                hour: index + 1,
                actual: Number(entry?.actual ?? 0),
                expected:
                  existing.totalActual === 0 ? rate : Number(entry?.expected ?? rate),
                closingReading: entry?.closingReading ?? null,
              };
            })
          )
        : (machineSpecificRate == null
            ? getCarryForwardExpected(entries, date, machine.id, shift, rate, hourCount)
            : Array.from({ length: hourCount }, () => rate)
          ).map((expected, i) => ({
            hour: i + 1,
            actual: 0,
            expected,
            closingReading: null,
          })),
      status: existing?.status ?? 'draft',
      operatorName: existing?.operatorName ?? (machine.operatorName ?? ''),
      notes: existing?.notes ?? '',
    };
  });
  return { rows, lockedHours };
}

export default function ProductionEntryClient() {
  const { access } = useAccess();
  const [date, setDate] = useState(getTodayISOLocal());
  const [shifts, setShifts] = useState<string[]>(() => getShifts());
  const [shift, setShift] = useState<Shift>(() => getShifts()[0] ?? '');
  const [rows, setRows] = useState<GridRow[]>(
    () => buildInitialRows(getTodayISOLocal(), getShifts()[0] ?? '').rows
  );
  const [lockedHours, setLockedHours] = useState<number[]>(
    () => buildInitialRows(getTodayISOLocal(), getShifts()[0] ?? '').lockedHours
  );
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingHour, setSavingHour] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isSavingRef = React.useRef(false);
  const hasDraftRef = React.useRef(false);

  const hasEntryData = rows.some(
    (r) => r.openingReading > 0 || r.entries.some((e) => e.closingReading !== null)
  );
  const hasDraft = rows.some((r) => r.status === 'draft' || r.status === 'flagged');
  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;
  const totalActual = rows.reduce(
    (sum, r) => sum + r.entries.reduce((s, e) => s + e.actual, 0),
    0
  );
  const totalExpected = rows.reduce(
    (sum, r) => sum + r.entries.reduce((s, e) => s + e.expected, 0),
    0
  );

  // Keep ref in sync with hasDraft for stale-closure-free reads
  useEffect(() => { hasDraftRef.current = hasDraft; }, [hasDraft]);

  useEffect(() => {
    const unsubShifts = subscribeShifts(() => {
      const next = getShifts();
      setShifts(next);
      if (!next.includes(shift)) {
        const fallback = next[0] ?? '';
        setShift(fallback);
        const built = buildInitialRows(date, fallback);
        setRows(built.rows);
        setLockedHours(built.lockedHours);
      }
    });
    return unsubShifts;
  }, [date, shift]);

  useEffect(() => {
    const unsub = subscribe(() => {
      // Check both refs and the global flag to make sure we never clobber user input.
      // Reading from the global flag avoids stale closures.
      if (isSavingRef.current) return;
      if (hasDraftRef.current) return;
      const built = buildInitialRows(date, shift);
      setRows(built.rows);
      setLockedHours(built.lockedHours);
    });
    return unsub;
  }, [date, shift]);

  // Mirror local draft state to the global store flag so the focus-refresh listener
  // in StoreBootstrap doesn't wipe the user's typed data when they switch back to the tab.
  useEffect(() => {
    setHasUnsavedDraft(hasDraft);
    return () => setHasUnsavedDraft(false);
  }, [hasDraft]);

  // Save current draft data silently. Used both for explicit shift/date switches AND
  // for debounced auto-save after every cell change.
  const autoSaveDraft = async (currentDate: string, currentShift: Shift, currentRows: GridRow[]) => {
    if (!currentShift) return;
    const hasData = currentRows.some(
      (r) => r.openingReading > 0 || r.entries.some((e) => e.closingReading !== null)
    );
    if (!hasData) return;
    const entries: ProductionEntry[] = currentRows.map((r) => ({
      id: `entry-${currentDate}-${currentShift}-${r.machineId}`,
      date: currentDate,
      machineId: r.machineId,
      itemId: r.itemId,
      shift: currentShift,
      openingReading: r.openingReading,
      entries: r.entries,
      status: r.status,
      operatorName: r.operatorName,
      notes: r.notes,
      totalActual: r.entries.reduce((s, e) => s + e.actual, 0),
      totalExpected: r.entries.reduce((s, e) => s + e.expected, 0),
      lockedHours: lockedHours,
    }));
    isSavingRef.current = true;
    try {
      await upsertEntries(entries);
    } catch (err) {
      console.warn('[ProductionEntry] Auto-save failed:', err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Debounced auto-save: whenever the user makes a change, queue a save for 1.5s later.
  // This ensures typed data persists to the DB even if the user never clicks Save Entries.
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasDraft) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveDraft(date, shift, rows).catch(() => {});
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, hasDraft, date, shift]);

  const handleShiftChange = async (s: Shift) => {
    if (s === shift) return;
    await autoSaveDraft(date, shift, rows);
    setShift(s);
    const built = buildInitialRows(date, s);
    setRows(built.rows);
    setLockedHours(built.lockedHours);
    setSaved(false);
  };

  const handleDateChange = async (d: string) => {
    if (d === date) return;
    await autoSaveDraft(date, shift, rows);
    setDate(d);
    const built = buildInitialRows(d, shift);
    setRows(built.rows);
    setLockedHours(built.lockedHours);
    setSaved(false);
  };

  const handleOpeningReadingChange = (machineIdx: number, value: number) => {
    setRows((prev) => {
      const next = [...prev];
      const openingReading = Math.max(0, value);
      const rebuilt = recalculateEntriesFromReadings(openingReading, next[machineIdx].entries);
      next[machineIdx] = {
        ...next[machineIdx],
        openingReading,
        entries: rebuilt,
        status: 'draft',
      };
      return next;
    });
    setSaved(false);
  };

  const handleCellChange = (machineIdx: number, hourIdx: number, value: number) => {
    setRows((prev) => {
      const next = [...prev];
      const row = next[machineIdx];
      const entry = row.entries[hourIdx];
      const expected = entry?.expected ?? 0;

      // Require opening reading before any hour can be entered
      if (row.openingReading === 0) {
        toast.error('Enter the opening reading before logging hourly production', { duration: 5000 });
        return prev;
      }

      const prevReading =
        hourIdx === 0
          ? row.openingReading
          : (row.entries[hourIdx - 1]?.closingReading ?? row.openingReading);
      const wouldBeActual = value > 0 ? Math.max(0, value - prevReading) : 0;

      // Block if closing is less than previous reading
      if (value > 0 && value < prevReading) {
        toast.error(
          `Reading ${value} is less than previous reading ${prevReading}. Enter the full meter reading.`,
          { duration: 5000 }
        );
        return prev;
      }

      // Block if actual would exceed target — max closing = prevReading + expected
      if (expected > 0 && wouldBeActual > expected) {
        toast.error(
          `Reading ${value} rejected — output would be ${wouldBeActual} pcs but target is ${expected} pcs/hr. Max allowed closing: ${prevReading + expected}`,
          { duration: 5000 }
        );
        return prev;
      }

      const changed = next[machineIdx].entries.map((e, i) =>
        i === hourIdx ? { ...e, closingReading: value <= 0 ? null : value } : e
      );
      const rebuilt = recalculateEntriesFromReadings(next[machineIdx].openingReading, changed);
      next[machineIdx] = {
        ...next[machineIdx],
        entries: rebuilt,
        status: 'draft',
      };
      return next;
    });
    setSaved(false);
  };

  const handleItemChange = (machineIdx: number, itemId: string) => {
    setRows((prev) => {
      const next = [...prev];
      const machine = getMachines().find((m) => m.id === next[machineIdx].machineId);
      const item = getItems().find((i) => i.id === itemId);
      const rate = Number(
        item?.rates.find((o) => o.machineId === machine?.id)?.rate ??
          item?.defaultRate ??
          machine?.expectedPerHour ??
          0
      );
      next[machineIdx] = {
        ...next[machineIdx],
        itemId,
        entries: next[machineIdx].entries.map((e) => ({ ...e, expected: rate })),
        status: 'draft',
      };
      return next;
    });
    setSaved(false);
  };

  const handleOperatorChange = (machineIdx: number, operatorName: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[machineIdx] = { ...next[machineIdx], operatorName };
      return next;
    });
    setSaved(false);
  };

  const handleNotesChange = (machineIdx: number, notes: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[machineIdx] = { ...next[machineIdx], notes };
      return next;
    });
    setSaved(false);
  };

  const handleSaveHour = async (hourIdx: number) => {
    if (lockedHours.includes(hourIdx)) return;
    setSavingHour(hourIdx);
    isSavingRef.current = true;
    const newLockedHours = [...lockedHours, hourIdx];
    const entries: ProductionEntry[] = rows.map((r) => ({
      id: `entry-${date}-${shift}-${r.machineId}`,
      date,
      machineId: r.machineId,
      itemId: r.itemId,
      shift,
      openingReading: r.openingReading,
      entries: r.entries,
      status: 'submitted' as const,
      operatorName: r.operatorName,
      notes: r.notes,
      totalActual: r.entries.reduce((s, e) => s + e.actual, 0),
      totalExpected: r.entries.reduce((s, e) => s + e.expected, 0),
      lockedHours: newLockedHours,
    }));
    try {
      await upsertEntries(entries);
      setLockedHours(newLockedHours);
      setRows((prev) => prev.map((r) => ({ ...r, status: 'submitted' as const })));
      toast.success(`Hour ${getShiftHours(shift)[hourIdx] ?? hourIdx + 1} saved and locked`);
    } catch {
      toast.error('Could not save hour — please retry');
    } finally {
      setSavingHour(null);
      isSavingRef.current = false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    isSavingRef.current = true;
    await new Promise((r) => setTimeout(r, 300));
    const updatedRows = rows.map((r) => ({ ...r, status: 'submitted' as const }));
    setRows(updatedRows);
    const entries: ProductionEntry[] = updatedRows.map((r) => ({
      id: `entry-${date}-${shift}-${r.machineId}`,
      date,
      machineId: r.machineId,
      itemId: r.itemId,
      shift,
      openingReading: r.openingReading,
      entries: r.entries,
      status: 'submitted',
      operatorName: r.operatorName,
      notes: r.notes,
      totalActual: r.entries.reduce((s, e) => s + e.actual, 0),
      totalExpected: r.entries.reduce((s, e) => s + e.expected, 0),
      lockedHours: Array.from({ length: getShiftHours(shift).length }, (_, i) => i),
    }));
    try {
      await upsertEntries(entries);
      setSaved(true);
      setLockedHours(Array.from({ length: getShiftHours(shift).length }, (_, i) => i));
      toast.success(`Entries saved — ${date}, Shift ${shift}`);
    } catch {
      toast.error('Could not save entries — please retry');
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleDeleteEntries = async () => {
    if (!access.isAdmin) return;
    setDeleting(true);
    isSavingRef.current = true;
    try {
      const res = await fetch(
        `/api/entries?date=${date}&shift=${encodeURIComponent(shift)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error();
      toast.success(`Entries deleted for ${date}, Shift ${shift}`);
      setConfirmDelete(false);
      setLockedHours([]);
      setSaved(false);
      const built = buildInitialRows(date, shift);
      setRows(
        built.rows.map((r) => ({
          ...r,
          openingReading: 0,
          entries: r.entries.map((e) => ({ ...e, actual: 0, closingReading: null })),
          status: 'draft' as const,
        }))
      );
    } catch {
      toast.error('Could not delete entries');
    } finally {
      setDeleting(false);
      isSavingRef.current = false;
    }
  };

  const handleCopyPrevious = (prevRows: GridRow[]) => {
    if (!access.isAdmin) {
      toast.error('Admin access required');
      return;
    }
    setRows(
      prevRows.map((r) => ({
        ...r,
        openingReading: 0,
        entries: r.entries.map((e) => ({ ...e, actual: 0, closingReading: null })),
        status: 'draft' as const,
      }))
    );
    setCopyOpen(false);
    toast.success('Previous day setup copied');
  };

  const handleImportData = (importedRows: GridRow[]) => {
    if (!access.isAdmin) {
      toast.error('Admin access required');
      return;
    }
    setRows(importedRows);
    setImportOpen(false);
    toast.success(`${importedRows.length} machine rows imported`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Production Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log hourly production per machine — actual vs expected
          </p>
        </div>
        <div className="flex items-center gap-2">
          {access.isAdmin && (
            <>
              <button
                onClick={() => setCopyOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors"
              >
                <Copy size={14} />
                Copy Previous Day
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors"
              >
                <Upload size={14} />
                Import
              </button>
              {hasEntryData && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-danger/30 text-danger rounded-md bg-card hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </>
          )}
          {/* Save button is available to both admins and operators — operators NEED to save their entries */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-60 min-w-[100px]"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved && !hasDraft ? (
              <>
                <CheckCircle2 size={14} />
                Saved
              </>
            ) : (
              <>
                <Save size={14} />
                Save Entries
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card-base p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Shift
            </label>
            <div className="flex gap-1">
              {shifts.map((s) => (
                <button
                  key={`shift-btn-${s}`}
                  onClick={() => handleShiftChange(s)}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                    shift === s
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  Shift {s}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden sm:block">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Hours
            </label>
            <div className="flex gap-1 flex-wrap">
              {getShiftHours(shift).map((h, i) => (
                <span
                  key={`hour-chip-${shift}-${i}`}
                  className="text-xs font-mono-nums bg-muted px-2 py-1 rounded text-muted-foreground"
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="font-mono-nums font-bold text-foreground text-sm">
              {totalActual.toLocaleString()}
            </p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Efficiency</p>
            <p
              className={`font-mono-nums font-bold text-sm ${
                totalExpected > 0 && totalActual / totalExpected >= 0.8
                  ? 'text-success'
                  : totalExpected > 0 && totalActual / totalExpected >= 0.5
                  ? 'text-warning'
                  : 'text-danger'
              }`}
            >
              {totalExpected > 0
                ? `${Math.round((totalActual / totalExpected) * 100)}%`
                : '—'}
            </p>
          </div>
          {hasDraft && (
            <>
              <div className="w-px h-8 bg-border" />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertCircle size={13} />
                unsaved changes
              </span>
            </>
          )}
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-danger">
              <AlertCircle size={13} />
              {flaggedCount} flagged
            </span>
          )}
        </div>
      </div>

      <EntryGrid
        rows={rows}
        shift={shift}
        shiftHours={getShiftHours(shift)}
        lockedHours={lockedHours}
        savingHour={savingHour}
        isAdmin={access.isAdmin}
        onOpeningReadingChange={handleOpeningReadingChange}
        onCellChange={handleCellChange}
        onItemChange={handleItemChange}
        onOperatorChange={handleOperatorChange}
        onNotesChange={handleNotesChange}
        onSaveHour={handleSaveHour}
      />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border rounded-xl p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">Delete All Entries?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently deletes all entries for <strong>{date}</strong>, Shift{' '}
                <strong>{shift}</strong>. Cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteEntries}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-danger text-white rounded-md hover:bg-danger/90 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportData}
        date={date}
        shift={shift}
      />
      <CopyPreviousModal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        onCopy={handleCopyPrevious}
        currentDate={date}
        shift={shift}
      />
    </div>
  );
}
