'use client';
import React, { useState, useEffect } from 'react';
import { Copy, Upload, Save, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
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
    const itemId = machine.currentItem ?? (items.find((i) => i.status === 'active')?.id ?? items[0]?.id ?? '');
    const item = items.find((candidate) => candidate.id === itemId);
    const machineSpecificRate = item?.rates.find((override) => override.machineId === machine.id)?.rate;
    const rate = Number(machineSpecificRate ?? item?.defaultRate ?? machine.expectedPerHour ?? 0);
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

  return { rows, lockedHours };
}

export default function ProductionEntryClient() {
  const { access } = useAccess();
  const [date, setDate] = useState(getTodayISOLocal());
  const [shifts, setShifts] = useState<string[]>(() => getShifts());
  const [shift, setShift] = useState<Shift>(() => getShifts()[0] ?? '');
  const [rows, setRows] = useState<GridRow[]>(() => buildInitialRows(getTodayISOLocal(), getShifts()[0] ?? '').rows);
  const [lockedHours, setLockedHours] = useState<number[]>(() => buildInitialRows(getTodayISOLocal(), getShifts()[0] ?? '').lockedHours);
  const [importOpen, setImportOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingHour, setSavingHour] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSavingRef = React.useRef(false);

  const hasEntryData = rows.some(
    (r) => r.openingReading > 0 || r.entries.some((e) => e.closingReading !== null)
  );
  const hasDraft = rows.some((r) => r.status === 'draft' || r.status === 'flagged');
  const flaggedCount = rows.filter((r) => r.status === 'flagged').length;

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
      if (!isSavingRef.current) {
        const built = buildInitialRows(date, shift);
        setRows(built.rows);
