'use client';
import React, { useState, useEffect } from 'react';
import { Copy, Upload, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import EntryGrid from './EntryGrid';
import ImportModal from './ImportModal';
import CopyPreviousModal from './CopyPreviousModal';
import { HourlyEntry, ProductionEntry } from '@/lib/mockData';
import { getMachines, getItems, getEntries, upsertEntries, subscribe } from '@/lib/store';
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

function buildInitialRows(date: string, shift: Shift): GridRow[] {
  if (!shift) return [];
  const machines = getMachines();
  const items = getItems();
  const entries = getEntries();
  const activeMachines = machines.filter((m) => m.status !== 'offline');
  return activeMachines.map((machine) => {
    const existing = entries.find(
      (e) => e.date === date && e.machineId === machine.id && e.shift === shift
    );
    const itemId = machine.currentItem ?? (items.find((i) => i.status === 'active')?.id ?? items[0]?.id ?? '');
    const item = items.find((candidate) => candidate.id === itemId);
    const machineSpecificRate = item?.rates.find((override) => override.machineId === machine.id)?.rate;
    const rate = Number(machineSpecificRate ?? item?.defaultRate ?? machine.expectedPerHour ?? 60);
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
                expected: existing.totalActual === 0 ? rate : Number(entry?.expected ?? rate),
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
}

export default function ProductionEntryClient() {
  const { access } = useAccess();
  const [date, setDate] = useState(getTodayISOLocal());
  const [shifts, setShifts] = useState<string[]>(() => getShifts());
  const [shift, setShift] = useState<Shift>(() => getShifts()[0] ?? '');
  const [rows, setRows] = useState<GridRow[]>(() => buildInitialRows(getTodayISOLocal(), getShifts()[0] ?? ''));
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isSavingRef = React.useRef(false);

  useEffect(() => {
    const unsubShifts = subscribeShifts(() => {
      const next = getShifts();
      setShifts(next);
      if (!next.includes(shift)) {
        const fallback = next[0] ?? '';
        setShift(fallback);
        setRows(buildInitialRows(date, fallback));
      }
    });
    return unsubShifts;
  }, [date, shift]);

  // Re-build rows when store changes (e.g. new machine/item added),
  // but NOT while a save is in progress (would wipe the just-saved data).
  useEffect(() => {
    const unsub = subscribe(() => {
      if (!isSavingRef.current) {
        setRows(buildInitialRows(date, shift));
      }
    });
    return unsub;
  }, [date, shift]);

  const handleShiftChange = (s: Shift) => {
    setShift(s);
    setRows(buildInitialRows(date, s));
    setSaved(false);
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    setRows(buildInitialRows(d, shift));
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
      const machine = getMachines().find((candidate) => candidate.id === next[machineIdx].machineId);
      const item = getItems().find((candidate) => candidate.id === itemId);
      const rate = Number(item?.rates.find((override) => override.machineId === machine?.id)?.rate ?? item?.defaultRate ?? machine?.expectedPerHour ?? 60);
      next[machineIdx] = {
        ...next[machineIdx],
        itemId,
        entries: next[machineIdx].entries.map((entry) => ({ ...entry, expected: rate })),
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

  const handleSave = async () => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    setSaving(true);
    isSavingRef.current = true;
    await new Promise((r) => setTimeout(r, 700));
    const updatedRows = rows.map((r) => ({ ...r, status: 'submitted' as const }));
    setRows(updatedRows);

    // Persist to store
    const entries: ProductionEntry[] = updatedRows.map((r, idx) => ({
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
    }));
    try {
      await upsertEntries(entries);
    } catch {
      setSaving(false);
      isSavingRef.current = false;
      toast.error('Production entries could not be saved');
      return;
    }

    setSaving(false);
    isSavingRef.current = false;
    setSaved(true);
    toast.success(`Production entries saved — ${date}, Shift ${shift}`);
  };

  const handleCopyPrevious = (prevRows: GridRow[]) => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    setRows(prevRows.map((r) => ({
      ...r,
      openingReading: 0,
      entries: r.entries.map((e) => ({ ...e, actual: 0, closingReading: null })),
      status: 'draft' as const,
    })));
    setCopyOpen(false);
    toast.success('Previous day setup copied — actual values cleared for new entry');
  };

  const handleImportData = (importedRows: GridRow[]) => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    setRows(importedRows);
    setImportOpen(false);
    toast.success(`${importedRows.length} machine rows imported successfully`);
  };

  const totalActual = rows.reduce((sum, r) => sum + r.entries.reduce((s, e) => s + e.actual, 0), 0);
  const totalExpected = rows.reduce((sum, r) => sum + r.entries.reduce((s, e) => s + e.expected, 0), 0);
  const draftCount = rows.filter((r) => r.status === 'draft').length;
  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Production Entry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log hourly production per machine — actual vs expected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!access.isAdmin}
            onClick={() => setCopyOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors"
          >
            <Copy size={14} />
            Copy Previous Day
          </button>
          <button
            disabled={!access.isAdmin}
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={handleSave}
            disabled={saving || draftCount === 0 || !access.isAdmin}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-60 min-w-[100px]"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
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

      {/* Filter bar */}
      <div className="card-base p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Shift</label>
            <div className="flex gap-1">
              {shifts.map((s) => (
                <button
                  key={`shift-btn-${s}`}
                  onClick={() => handleShiftChange(s)}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                    shift === s
                      ? 'bg-primary text-white' :'bg-muted text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  Shift {s}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden sm:block">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Hours</label>
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

        {/* Summary pills */}
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="font-mono-nums font-bold text-foreground text-sm">{totalActual.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Efficiency</p>
            <p className={`font-mono-nums font-bold text-sm ${
              totalExpected > 0 && (totalActual / totalExpected) >= 0.8
                ? 'text-success'
                : totalExpected > 0 && (totalActual / totalExpected) >= 0.5
                ? 'text-warning' :'text-danger'
            }`}>
              {totalExpected > 0 ? `${Math.round((totalActual / totalExpected) * 100)}%` : '—'}
            </p>
          </div>
          {draftCount > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <AlertCircle size={13} />
                {draftCount} unsaved
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

      {/* Entry grid */}
      <EntryGrid
        rows={rows}
        shift={shift}
        shiftHours={getShiftHours(shift)}
        onOpeningReadingChange={handleOpeningReadingChange}
        onCellChange={handleCellChange}
        onItemChange={handleItemChange}
        onOperatorChange={handleOperatorChange}
        onNotesChange={handleNotesChange}
      />

      {/* Modals */}
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


