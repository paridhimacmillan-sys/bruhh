'use client';

import {
  MACHINES as INITIAL_MACHINES,
  ITEMS as INITIAL_ITEMS,
  PRODUCTION_ENTRIES as INITIAL_ENTRIES,
  Machine,
  Item,
  ProductionEntry,
} from './mockData';

type Listener = () => void;
const listeners: Set<Listener> = new Set();
function notify() {
  listeners.forEach((l) => l());
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
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

export async function refreshStore(): Promise<void> {
  const data = await api<{ machines: Machine[]; items: Item[]; entries: ProductionEntry[] }>(
    '/api/bootstrap',
    { cache: 'no-store' }
  );
  // Neon is the single source of truth. Replacing empty arrays matters:
  // otherwise different browsers can retain different stale inventories.
  machines = data.machines;
  items = data.items;
  entries = data.entries;
  dbReady = true;
  notify();
}

export async function bootstrapStore(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = refreshStore().catch((err) => {
    notify();
    console.warn('[MachineTrack] API bootstrap failed:', err);
  });
  return bootstrapPromise;
}

export function getMachines(): Machine[] { return machines; }

export async function addMachine(m: Machine) {
  if (!dbReady) throw new Error('Database is still loading');
  await api('/api/machines', { method: 'POST', body: JSON.stringify(m) });
  machines = [...machines, m];
  notify();
}

export async function updateMachine(id: string, data: Partial<Machine>) {
  if (!dbReady) throw new Error('Database is still loading');
  await api(`/api/machines/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  machines = machines.map((m) => (m.id === id ? { ...m, ...data } : m));
  notify();
}

export async function deleteMachine(id: string) {
  if (!dbReady) throw new Error('Database is still loading');
  await api(`/api/machines/${id}`, { method: 'DELETE' });
  machines = machines.filter((m) => m.id !== id);
  notify();
}

export function getItems(): Item[] { return items; }

export async function addItem(item: Item) {
  if (!dbReady) throw new Error('Database is still loading');
  await api('/api/items', { method: 'POST', body: JSON.stringify(item) });
  items = [...items, item];
  notify();
}

export async function updateItem(id: string, data: Partial<Item>) {
  if (!dbReady) throw new Error('Database is still loading');
  await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  items = items.map((i) => (i.id === id ? { ...i, ...data } : i));
  notify();
}

export async function deleteItem(id: string) {
  if (!dbReady) throw new Error('Database is still loading');
  await api(`/api/items/${id}`, { method: 'DELETE' });
  items = items.filter((i) => i.id !== id);
  notify();
}

export function getEntries(): ProductionEntry[] { return entries; }

export async function upsertEntries(newEntries: ProductionEntry[]) {
  if (!dbReady) throw new Error('Database is still loading');
  await api('/api/entries', { method: 'POST', body: JSON.stringify(newEntries) });
  const updated = [...entries];
  newEntries.forEach((ne) => {
    const idx = updated.findIndex(
      (e) => e.date === ne.date && e.machineId === ne.machineId && e.shift === ne.shift
    );
    if (idx >= 0) updated[idx] = ne;
    else updated.push(ne);
  });
  entries = updated;
  notify();
}

export async function fetchEntriesForRange(dateFrom: string, dateTo: string): Promise<ProductionEntry[]> {
  if (dbReady) {
    try {
      const q = new URLSearchParams({ dateFrom, dateTo });
      return await api<ProductionEntry[]>(`/api/entries?${q.toString()}`);
    } catch (err) {
      console.warn('[MachineTrack] API range fetch failed, using memory:', err);
    }
  }
  return entries.filter((e) => e.date >= dateFrom && e.date <= dateTo);
}

export function getDashboardData(date: string, shift: string | 'all') {
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

  const trendHourCount = filteredEntries.reduce((max, entry) => Math.max(max, entry.entries.length), 0);
  const hourlyTrend = Array.from({ length: trendHourCount }, (_, i) => {
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
