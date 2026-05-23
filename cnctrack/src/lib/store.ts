'use client';
// Unified store: persists to Supabase when credentials are configured,
// falls back to in-memory mock data so the app still works locally.

import {
  MACHINES as INITIAL_MACHINES,
  ITEMS as INITIAL_ITEMS,
  PRODUCTION_ENTRIES as INITIAL_ENTRIES,
  Machine,
  Item,
  ProductionEntry,
} from './mockData';

import {
  dbGetMachines,
  dbAddMachine,
  dbUpdateMachine,
  dbDeleteMachine,
  dbGetItems,
  dbAddItem,
  dbUpdateItem,
  dbDeleteItem,
  dbGetEntries,
  dbUpsertEntries,
} from './neon';

function isSupabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL ?? '';
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let machines: Machine[] = [...INITIAL_MACHINES];
let items: Item[] = [...INITIAL_ITEMS];
let entries: ProductionEntry[] = [...INITIAL_ENTRIES];
let dbReady = false;

let bootstrapPromise: Promise<void> | null = null;

export async function bootstrapStore(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const [dbMachines, dbItems, dbEntries] = await Promise.all([
        dbGetMachines(),
        dbGetItems(),
        dbGetEntries(),
      ]);
      if (dbMachines.length > 0) machines = dbMachines;
      if (dbItems.length > 0) items = dbItems;
      if (dbEntries.length > 0) entries = dbEntries;
      dbReady = true;
      notify();
    } catch (err) {
      console.warn('[CNCTrack] Supabase bootstrap failed — running on mock data:', err);
    }
  })();
  return bootstrapPromise;
}

export function getMachines(): Machine[] { return machines; }

export async function addMachine(m: Machine) {
  machines = [...machines, m]; notify();
  if (dbReady) await dbAddMachine(m).catch(console.error);
}

export async function updateMachine(id: string, data: Partial<Machine>) {
  machines = machines.map((m) => (m.id === id ? { ...m, ...data } : m)); notify();
  if (dbReady) await dbUpdateMachine(id, data).catch(console.error);
}

export async function deleteMachine(id: string) {
  machines = machines.filter((m) => m.id !== id); notify();
  if (dbReady) await dbDeleteMachine(id).catch(console.error);
}

export function getItems(): Item[] { return items; }

export async function addItem(item: Item) {
  items = [...items, item]; notify();
  if (dbReady) await dbAddItem(item).catch(console.error);
}

export async function updateItem(id: string, data: Partial<Item>) {
  items = items.map((i) => (i.id === id ? { ...i, ...data } : i)); notify();
  if (dbReady) await dbUpdateItem(id, data).catch(console.error);
}

export async function deleteItem(id: string) {
  items = items.filter((i) => i.id !== id); notify();
  if (dbReady) await dbDeleteItem(id).catch(console.error);
}

export function getEntries(): ProductionEntry[] { return entries; }

export async function upsertEntries(newEntries: ProductionEntry[]) {
  const updated = [...entries];
  newEntries.forEach((ne) => {
    const idx = updated.findIndex(
      (e) => e.date === ne.date && e.machineId === ne.machineId && e.shift === ne.shift
    );
    if (idx >= 0) { updated[idx] = ne; } else { updated.push(ne); }
  });
  entries = updated; notify();
  if (dbReady) await dbUpsertEntries(newEntries).catch(console.error);
}

export async function fetchEntriesForRange(dateFrom: string, dateTo: string): Promise<ProductionEntry[]> {
  if (dbReady) {
    try { return await dbGetEntries({ dateFrom, dateTo }); }
    catch (err) { console.warn('[CNCTrack] DB range fetch failed, using memory:', err); }
  }
  return entries.filter((e) => e.date >= dateFrom && e.date <= dateTo);
}

export function getDashboardData(date: string, shift: 'A' | 'B' | 'C' | 'all') {
  const filteredEntries = entries.filter(
    (e) => e.date === date && (shift === 'all' || e.shift === shift)
  );
  const totalActual = filteredEntries.reduce((s, e) => s + e.totalActual, 0);
  const totalExpected = filteredEntries.reduce((s, e) => s + e.totalExpected, 0);

  const machineOutput = machines.map((m) => {
    const mEntries = filteredEntries.filter((e) => e.machineId === m.id);
    const actual = mEntries.reduce((s, e) => s + e.totalActual, 0);
    const expected = mEntries.reduce((s, e) => s + e.totalExpected, 0);
    return { machine: m.machineNumber, actual, target: expected };
  });

  const itemOutput = items.map((item) => {
    const iEntries = filteredEntries.filter((e) => e.itemId === item.id);
    const actual = iEntries.reduce((s, e) => s + e.totalActual, 0);
    const expected = iEntries.reduce((s, e) => s + e.totalExpected, 0);
    const machineNums = iEntries
      .map((e) => machines.find((m) => m.id === e.machineId)?.machineNumber ?? '').filter(Boolean);
    return { itemId: item.id, itemName: item.itemName, totalActual: actual, totalTarget: expected, machines: [...new Set(machineNums)] };
  });

  const hourlyTrend = Array.from({ length: 8 }, (_, i) => {
    const actual = filteredEntries.reduce((s, e) => s + (e.entries[i]?.actual ?? 0), 0);
    const target = filteredEntries.reduce((s, e) => s + (e.entries[i]?.expected ?? 0), 0);
    return { hour: `H${i + 1}`, actual, target };
  });

  const activeMachines = machines.filter((m) => m.status === 'active');
  const onTargetMachines = activeMachines.filter((m) => {
    const mData = machineOutput.find((mo) => mo.machine === m.machineNumber);
    if (!mData || mData.target === 0) return false;
    return mData.actual / mData.target >= 0.8;
  });
  const downMachines = machines.filter((m) => m.status === 'maintenance' || m.status === 'offline');
  const loggedHours = filteredEntries.reduce((s, e) => s + e.entries.filter((h) => h.actual > 0).length, 0);
  const totalGap = totalExpected - totalActual;
  const avgHourlyGap = loggedHours > 0 ? Math.round(totalGap / loggedHours) : 0;

  return {
    totalActual, totalExpected,
    efficiency: totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0,
    machineOutput, itemOutput, hourlyTrend,
    onTargetMachines, downMachines, activeMachines,
    avgHourlyGap: Math.max(0, avgHourlyGap),
  };
}
