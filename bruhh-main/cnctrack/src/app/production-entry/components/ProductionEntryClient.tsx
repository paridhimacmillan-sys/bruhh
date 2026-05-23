'use client';
import React, { useState, useEffect } from 'react';
import { Copy, Upload, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import EntryGrid from './EntryGrid';
import ImportModal from './ImportModal';
import CopyPreviousModal from './CopyPreviousModal';
import { HourlyEntry, ProductionEntry } from '@/lib/mockData';
import { getMachines, getItems, getEntries, upsertEntries, subscribe } from '@/lib/store';

type Shift = 'A' | 'B' | 'C';

export interface GridRow {
  machineId: string;
  itemId: string;
  entries: HourlyEntry[];
  status: 'draft' | 'submitted' | 'flagged';
  operatorName: string;
  notes: string;
}

const SHIFT_HOURS: Record<Shift, string[]> = {
  A: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00'],
  B: ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
  C: ['22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'],
};

function buildInitialRows(date: string, shift: Shift): GridRow[] {
  const machines = getMachines();
  const items = getItems();
  const entries = getEntries();
  const activeMachines = machines.filter((m) => m.status !== 'offline');
  return activeMachines.map((machine) => {
    const existing = entries.find(
      (e) => e.date === date && e.machineId === machine.id && e.shift === shift
    );
    const itemId = machine.currentItem ?? (items.find((i) => i.status === 'active')?.id ?? items[0]?.id ?? '');
    const item = items.find((i) => i.id === itemId) ?? items[0];
    const rate = Number(item?.rates.find((r) => r.machineId === machine.id)?.rate ?? item?.defaultRate ?? 60);
    return {
      machineId: machine.id,
      itemId,
      entries: existing
        ? existing.entries.map((e) => ({ ...e, actual: Number(e.actual), expected: Number(e.expected) }))
        : Array.from({ length: 8 }, (_, i) => ({
            hour: i + 1,
            actual: 0,
            expected: rate,
          })),
      status: existing?.status ?? 'draft',
      operatorName: existing?.operatorName ?? (machine.operatorName ?? ''),
      notes: existing?.notes ?? '',
    };
  });
}

export default function ProductionEntryClient() {
  const [date, setDate] = useState('2026-05-10');
  const [shift, setShift] = useState<Shift>('A');
  const [rows, setRows] = useState<GridRow[]>(() => buildInitialRows('2026-05-10', 'A'));
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isSavingRef = React.useRef(false);

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

  const handleCellChange = (machineIdx: number, hourIdx: number, value: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[machineIdx] = {
        ...next[machineIdx],
        entries: next[machineIdx].entries.map((e, i) =>
          i === hourIdx ? { ...e, actual: value } : e
        ),
        status: 'draft',
      };
      return next;
    });
    setSaved(false);
  };

  const handleItemChange = (machineIdx: number, itemId: string) => {
    const items = getItems();
    const machines = getMachines();
    setRows((prev) => {
      const next = [...prev];
      const item = items.find((i) => i.id === itemId);
      const machineId = next[machineIdx].machineId;
      const rate = Number(item?.rates.find((r) => r.machineId === machineId)?.rate ?? item?.defaultRate ?? 60);
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

  const handleSave = async () => {
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
      entries: r.entries,
      status: 'submitted',
      operatorName: r.operatorName,
      notes: r.notes,
      totalActual: r.entries.reduce((s, e) => s + e.actual, 0),
      totalExpected: r.entries.reduce((s, e) => s + e.expected, 0),
    }));
    upsertEntries(entries);

    setSaving(false);
    isSavingRef.current = false;
    setSaved(true);
    toast.success(`Production entries saved — ${date}, Shift ${shift}`);
  };

  const handleCopyPrevious = (prevRows: GridRow[]) => {
    setRows(prevRows.map((r) => ({
      ...r,
      entries: r.entries.map((e) => ({ ...e, actual: 0 })),
      status: 'draft' as const,
    })));
    setCopyOpen(false);
    toast.success('Previous day setup copied — actual values cleared for new entry');
  };

  const handleImportData = (importedRows: GridRow[]) => {
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
          <button
            onClick={handleSave}
            disabled={saving || draftCount === 0}
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
              {(['A', 'B', 'C'] as Shift[]).map((s) => (
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
              {SHIFT_HOURS[shift].map((h, i) => (
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
            <p className="text-xs text-muted-foreground">Total Expected</p>
            <p className="font-mono-nums font-bold text-muted-foreground text-sm">{totalExpected.toLocaleString()}</p>
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
        shiftHours={SHIFT_HOURS[shift]}
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
