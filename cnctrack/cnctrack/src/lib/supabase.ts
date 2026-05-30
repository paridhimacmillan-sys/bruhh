// Supabase client — replace NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// in your .env file with your actual project credentials.
// Run the SQL in /supabase/schema.sql against your project to create tables.

import { createClient } from '@supabase/supabase-js';
import { Machine, Item, ProductionEntry } from './mockData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Machines ────────────────────────────────────────────────────────────────

export async function dbGetMachines(): Promise<Machine[]> {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .order('machine_number');
  if (error) throw error;
  return (data ?? []).map(rowToMachine);
}

export async function dbAddMachine(m: Machine): Promise<void> {
  const { error } = await supabase.from('machines').insert(machineToRow(m));
  if (error) throw error;
}

export async function dbUpdateMachine(id: string, data: Partial<Machine>): Promise<void> {
  const partial = machineToRow({ ...data, id } as Machine);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, ...rest } = partial as Record<string, unknown>;
  const { error } = await supabase.from('machines').update(rest).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteMachine(id: string): Promise<void> {
  const { error } = await supabase.from('machines').delete().eq('id', id);
  if (error) throw error;
}

// ─── Items ───────────────────────────────────────────────────────────────────

export async function dbGetItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('item_name');
  if (error) throw error;
  return (data ?? []).map(rowToItem);
}

export async function dbAddItem(item: Item): Promise<void> {
  const { error } = await supabase.from('items').insert(itemToRow(item));
  if (error) throw error;
}

export async function dbUpdateItem(id: string, data: Partial<Item>): Promise<void> {
  const partial = itemToRow({ ...data, id } as Item);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, ...rest } = partial as Record<string, unknown>;
  const { error } = await supabase.from('items').update(rest).eq('id', id);
  if (error) throw error;
}

export async function dbDeleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

// ─── Production Entries ───────────────────────────────────────────────────────

export async function dbGetEntries(filters?: {
  dateFrom?: string;
  dateTo?: string;
  machineId?: string;
  shift?: string;
}): Promise<ProductionEntry[]> {
  let q = supabase.from('production_entries').select('*').order('date', { ascending: false });
  if (filters?.dateFrom) q = q.gte('date', filters.dateFrom);
  if (filters?.dateTo) q = q.lte('date', filters.dateTo);
  if (filters?.machineId) q = q.eq('machine_id', filters.machineId);
  if (filters?.shift) q = q.eq('shift', filters.shift);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export async function dbUpsertEntries(entries: ProductionEntry[]): Promise<void> {
  const rows = entries.map(entryToRow);
  const { error } = await supabase
    .from('production_entries')
    .upsert(rows, { onConflict: 'date,machine_id,shift' });
  if (error) throw error;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export interface AlertThreshold {
  id: string;
  name: string;
  type: 'efficiency_below' | 'hourly_gap_above' | 'machine_down' | 'flagged_entry';
  threshold: number;       // numeric threshold (%, pcs, count)
  enabled: boolean;
  notify_in_app: boolean;
  created_at: string;
}

export interface AlertEvent {
  id: string;
  alert_id: string | null;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  machine_id: string | null;
  resolved: boolean;
  created_at: string;
}

export async function dbGetAlertThresholds(): Promise<AlertThreshold[]> {
  const { data, error } = await supabase
    .from('alert_thresholds')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function dbUpsertAlertThreshold(t: Omit<AlertThreshold, 'created_at'>): Promise<void> {
  const { error } = await supabase.from('alert_thresholds').upsert(t, { onConflict: 'id' });
  if (error) throw error;
}

export async function dbDeleteAlertThreshold(id: string): Promise<void> {
  const { error } = await supabase.from('alert_thresholds').delete().eq('id', id);
  if (error) throw error;
}

export async function dbGetAlertEvents(limit = 50): Promise<AlertEvent[]> {
  const { data, error } = await supabase
    .from('alert_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function dbInsertAlertEvent(e: Omit<AlertEvent, 'id' | 'created_at'>): Promise<void> {
  const { error } = await supabase.from('alert_events').insert(e);
  if (error) throw error;
}

export async function dbResolveAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from('alert_events')
    .update({ resolved: true })
    .eq('id', id);
  if (error) throw error;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMachine(r: any): Machine {
  return {
    id: r.id,
    machineType: r.machine_type,
    machineNumber: r.machine_number,
    expectedPerHour: Number(r.machine_target_rate ?? 60),
    status: r.status,
    currentItem: r.current_item,
    operatorName: r.operator_name,
    lastEntryTime: r.last_entry_time,
    assignedItems: r.assigned_items ?? [],
    createdAt: r.created_at,
  };
}

function machineToRow(m: Machine) {
  return {
    id: m.id,
    machine_type: m.machineType,
    machine_number: m.machineNumber,
    machine_target_rate: m.expectedPerHour,
    status: m.status,
    current_item: m.currentItem,
    operator_name: m.operatorName,
    last_entry_time: m.lastEntryTime,
    assigned_items: m.assignedItems,
    created_at: m.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(r: any): Item {
  return {
    id: r.id,
    itemName: r.item_name,
    defaultRate: r.default_rate,
    rates: r.rates ?? [],
    status: r.status,
    unit: r.unit,
    createdAt: r.created_at,
  };
}

function itemToRow(i: Item) {
  return {
    id: i.id,
    item_name: i.itemName,
    default_rate: i.defaultRate,
    rates: i.rates,
    status: i.status,
    unit: i.unit,
    created_at: i.createdAt,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(r: any): ProductionEntry {
  return {
    id: r.id,
    date: r.date,
    machineId: r.machine_id,
    itemId: r.item_id,
    shift: r.shift,
    entries: r.entries ?? [],
    status: r.status,
    operatorName: r.operator_name,
    notes: r.notes ?? '',
    totalActual: r.total_actual,
    totalExpected: r.total_expected,
  };
}

function entryToRow(e: ProductionEntry) {
  return {
    id: e.id,
    date: e.date,
    machine_id: e.machineId,
    item_id: e.itemId,
    shift: e.shift,
    entries: e.entries,
    status: e.status,
    operator_name: e.operatorName,
    notes: e.notes,
    total_actual: e.totalActual,
    total_expected: e.totalExpected,
  };
}
