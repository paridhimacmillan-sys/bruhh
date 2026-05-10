'use client';
// In-memory store for app-wide state (replaces static mock data with mutable state)
// Backend integration point: replace with API calls / Supabase / database

import {
  MACHINES as INITIAL_MACHINES,
  ITEMS as INITIAL_ITEMS,
  PRODUCTION_ENTRIES as INITIAL_ENTRIES,
  Machine,
  Item,
  ProductionEntry,
} from './mockData';

// Simple event emitter for cross-component updates
type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Mutable state
let machines: Machine[] = [...INITIAL_MACHINES];
let items: Item[] = [...INITIAL_ITEMS];
let entries: ProductionEntry[] = [...INITIAL_ENTRIES];

// --- MACHINES ---
export function getMachines(): Machine[] {
  return machines;
}

export function addMachine(m: Machine) {
  machines = [...machines, m];
  notify();
}

export function updateMachine(id: string, data: Partial<Machine>) {
  machines = machines.map((m) => (m.id === id ? { ...m, ...data } : m));
  notify();
}

export function deleteMachine(id: string) {
  machines = machines.filter((m) => m.id !== id);
  notify();
}

// --- ITEMS ---
export function getItems(): Item[] {
  return items;
}

export function addItem(item: Item) {
  items = [...items, item];
  notify();
}

export function updateItem(id: string, data: Partial<Item>) {
  items = items.map((i) => (i.id === id ? { ...i, ...data } : i));
  notify();
}

export function deleteItem(id: string) {
  items = items.filter((i) => i.id !== id);
  notify();
}

// --- PRODUCTION ENTRIES ---
export function getEntries(): ProductionEntry[] {
  return entries;
}

export function upsertEntries(newEntries: ProductionEntry[]) {
  // Replace entries for the same date/machine/shift, add new ones
  const updated = [...entries];
  newEntries.forEach((ne) => {
    const idx = updated.findIndex(
      (e) => e.date === ne.date && e.machineId === ne.machineId && e.shift === ne.shift
    );
    if (idx >= 0) {
      updated[idx] = ne;
    } else {
      updated.push(ne);
    }
  });
  entries = updated;
  notify();
}

// --- COMPUTED DASHBOARD DATA ---
export function getDashboardData(date: string, shift: 'A' | 'B' | 'C' | 'all') {
  const filteredEntries = entries.filter(
    (e) => e.date === date && (shift === 'all' || e.shift === shift)
  );

  const totalActual = filteredEntries.reduce((s, e) => s + e.totalActual, 0);
  const totalExpected = filteredEntries.reduce((s, e) => s + e.totalExpected, 0);

  // Per-machine output
  const machineOutput = machines.map((m) => {
    const mEntries = filteredEntries.filter((e) => e.machineId === m.id);
    const actual = mEntries.reduce((s, e) => s + e.totalActual, 0);
    const expected = mEntries.reduce((s, e) => s + e.totalExpected, 0);
    return { machine: m.machineNumber, actual, target: expected };
  });

  // Per-item output
  const itemOutput = items.map((item) => {
    const iEntries = filteredEntries.filter((e) => e.itemId === item.id);
    const actual = iEntries.reduce((s, e) => s + e.totalActual, 0);
    const expected = iEntries.reduce((s, e) => s + e.totalExpected, 0);
    const machineNums = iEntries
      .map((e) => machines.find((m) => m.id === e.machineId)?.machineNumber ?? '')
      .filter(Boolean);
    return {
      itemId: item.id,
      itemName: item.itemName,
      totalActual: actual,
      totalTarget: expected,
      machines: [...new Set(machineNums)],
    };
  });

  // Hourly trend (aggregate across all machines for the shift)
  const hourlyTrend = Array.from({ length: 8 }, (_, i) => {
    const actual = filteredEntries.reduce((s, e) => s + (e.entries[i]?.actual ?? 0), 0);
    const target = filteredEntries.reduce((s, e) => s + (e.entries[i]?.expected ?? 0), 0);
    return { hour: `H${i + 1}`, actual, target };
  });

  // On-target machines
  const activeMachines = machines.filter((m) => m.status === 'active');
  const onTargetMachines = activeMachines.filter((m) => {
    const mData = machineOutput.find((mo) => mo.machine === m.machineNumber);
    if (!mData || mData.target === 0) return false;
    return mData.actual / mData.target >= 0.8;
  });

  const downMachines = machines.filter(
    (m) => m.status === 'maintenance' || m.status === 'offline'
  );

  // Hourly gap (avg shortfall per logged hour)
  const loggedHours = filteredEntries.reduce((s, e) => {
    return s + e.entries.filter((h) => h.actual > 0).length;
  }, 0);
  const totalGap = totalExpected - totalActual;
  const avgHourlyGap = loggedHours > 0 ? Math.round(totalGap / loggedHours) : 0;

  return {
    totalActual,
    totalExpected,
    efficiency: totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0,
    machineOutput,
    itemOutput,
    hourlyTrend,
    onTargetMachines,
    downMachines,
    activeMachines,
    avgHourlyGap: Math.max(0, avgHourlyGap),
  };
}
