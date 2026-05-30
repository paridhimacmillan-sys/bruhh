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
const LOCAL_KEY = 'cnctrack.store.v1';

function notify() {
  listeners.forEach((l) => l());
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function saveLocalSnapshot() {
  if (!canUseLocalStorage() || dbReady) return;
  try {
    window.localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ machines, items, entries })
    );
  } catch (err) {
    console.warn('[MachineTrack] Failed to save local snapshot:', err);
  }
}

function loadLocalSnapshot() {
  if (!canUseLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      machines?: Machine[];
      items?: Item[];
      entries?: ProductionEntry[];
    };
    if (Array.isArray(parsed.machines) && parsed.machines.length > 0) machines = parsed.machines;
    if (Array.isArray(parsed.items) && parsed.items.length > 0) items = parsed.items;
    if (Array.isArray(parsed.entries) && parsed.entries.length > 0) entries = parsed.entries;
  } catch (err) {
    console.warn('[MachineTrack] Failed to load local snapshot:', err);
  }
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

export async function bootstrapStore(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const data = await api<{ machines: Machine[]; items: Item[]; entries: ProductionEntry[] }>(
        '/api/bootstrap',
        { cache: 'no-store' }
      );
      if (data.machines.length > 0) machines = data.machines;
      if (data.items.length > 0) items = data.items;
      if (data.entries.length > 0) entries = data.entries;
      dbReady = true;
      notify();
    } catch (err) {
      loadLocalSnapshot();
      notify();
      console.warn('[MachineTrack] API bootstrap failed; using local snapshot:', err);
    }
  })();
  return bootstrapPromise;
}

export function getMachines(): Machine[] { return machines; }

export async function addMachine(m: Machine) {
  machines = [...machines, m];
  notify();
  saveLocalSnapshot();
  if (dbReady) await api('/api/machines', { method: 'POST', body: JSON.stringify(m) }).catch(console.error);
}

export async function updateMachine(id: string, data: Partial<Machine>) {
  machines = machines.map((m) => (m.id === id ? { ...m, ...data } : m));
  notify();
  saveLocalSnapshot();
  if (dbReady) await api(`/api/machines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).catch(console.error);
}

export async function deleteMachine(id: string) {
  machines = machines.filter((m) => m.id !== id);
  notify();
  saveLocalSnapshot();
  if (dbReady) await api(`/api/machines/${id}`, { method: 'DELETE' }).catch(console.error);
}

export function getItems(): Item[] { return items; }

export async function addItem(item: Item) {
  items = [...items, item];
  notify();
  saveLocalSnapshot();
  if (dbReady) await api('/api/items', { method: 'POST', body: JSON.stringify(item) }).catch(console.error);
}

export async function updateItem(id: string, data: Partial<Item>) {
  items = items.map((i) => (i.id === id ? { ...i, ...data } : i));
  notify();
  saveLocalSnapshot();
  if (dbReady) await api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).catch(console.error);
}

export async function deleteItem(id: string) {
  items = items.filter((i) => i.id !== id);
  notify();
  saveLocalSnapshot();
  if (dbReady) await api(`/api/items/${id}`, { method: 'DELETE' }).catch(console.error);
}

export function getEntries(): ProductionEntry[] { return entries; }

export async function upsertEntries(newEntries: ProductionEntry[]) {
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
  saveLocalSnapshot();
  if (dbReady) await api('/api/entries', { method: 'POST', body: JSON.stringify(newEntries) }).catch(console.error);
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

