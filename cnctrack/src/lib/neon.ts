// Neon PostgreSQL database layer — drop-in replacement for supabase.ts
// All functions have identical signatures so store.ts works unchanged.

import sql from './db';
import { Machine, Item, ProductionEntry } from './mockData';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AlertThreshold {
  id: string;
  name: string;
  type: 'efficiency_below' | 'hourly_gap_above' | 'machine_down' | 'flagged_entry';
  threshold: number;
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

// ─── Machines ────────────────────────────────────────────────────────────────

async function dbEnsureMachines(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      machine_type TEXT NOT NULL DEFAULT '',
      machine_number TEXT NOT NULL UNIQUE,
      machine_target_rate INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      current_item TEXT,
      operator_name TEXT,
      last_entry_time TEXT,
      assigned_items JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_number TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_target_rate INTEGER`;
  await sql`ALTER TABLE machines ALTER COLUMN machine_target_rate DROP DEFAULT`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_item TEXT`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS operator_name TEXT`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS last_entry_time TEXT`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS assigned_items JSONB NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE machines ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_number_unique ON machines(machine_number)`;
}

export async function dbGetMachines(): Promise<Machine[]> {
  await dbEnsureMachines();
  const rows = await sql`SELECT * FROM machines ORDER BY machine_number`;
  return rows.map(rowToMachine);
}

export async function dbAddMachine(m: Machine): Promise<void> {
  await dbEnsureMachines();
  await sql`
    INSERT INTO machines (id, machine_type, machine_number, machine_target_rate, status, current_item, operator_name, last_entry_time, assigned_items, created_at)
    VALUES (${m.id}, ${m.machineType}, ${m.machineNumber}, ${m.expectedPerHour}, ${m.status}, ${m.currentItem}, ${m.operatorName}, ${m.lastEntryTime}, ${JSON.stringify(m.assignedItems)}, ${m.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      machine_type = EXCLUDED.machine_type,
      machine_number = EXCLUDED.machine_number,
      machine_target_rate = EXCLUDED.machine_target_rate,
      status = EXCLUDED.status,
      current_item = EXCLUDED.current_item,
      operator_name = EXCLUDED.operator_name,
      last_entry_time = EXCLUDED.last_entry_time,
      assigned_items = EXCLUDED.assigned_items
  `;
}

export async function dbUpdateMachine(id: string, data: Partial<Machine>): Promise<void> {
  await dbEnsureMachines();
  const m = data as Partial<Machine>;
  await sql`
    UPDATE machines SET
      machine_type    = COALESCE(${m.machineType ?? null}, machine_type),
      machine_number  = COALESCE(${m.machineNumber ?? null}, machine_number),
      machine_target_rate = COALESCE(${m.expectedPerHour ?? null}, machine_target_rate),
      status          = COALESCE(${m.status ?? null}, status),
      current_item    = COALESCE(${m.currentItem ?? null}, current_item),
      operator_name   = COALESCE(${m.operatorName ?? null}, operator_name),
      last_entry_time = COALESCE(${m.lastEntryTime ?? null}, last_entry_time),
      assigned_items  = COALESCE(${m.assignedItems ? JSON.stringify(m.assignedItems) : null}::jsonb, assigned_items)
    WHERE id = ${id}
  `;
}

export async function dbDeleteMachine(id: string): Promise<void> {
  await dbEnsureMachines();
  await sql`DELETE FROM machines WHERE id = ${id}`;
}

// ─── Items ───────────────────────────────────────────────────────────────────

async function dbEnsureItems(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL DEFAULT '',
      default_rate INTEGER NOT NULL,
      rates JSONB NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      unit TEXT NOT NULL DEFAULT 'pcs/hr',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS item_name TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS default_rate INTEGER`;
  await sql`ALTER TABLE items ALTER COLUMN default_rate DROP DEFAULT`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS rates JSONB NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs/hr'`;
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
}

export async function dbGetItems(): Promise<Item[]> {
  await dbEnsureItems();
  const rows = await sql`SELECT * FROM items ORDER BY item_name`;
  return rows.map(rowToItem);
}

export async function dbAddItem(item: Item): Promise<void> {
  await dbEnsureItems();
  await sql`
    INSERT INTO items (id, item_name, default_rate, rates, status, unit, created_at)
    VALUES (${item.id}, ${item.itemName}, ${item.defaultRate}, ${JSON.stringify(item.rates)}, ${item.status}, ${item.unit}, ${item.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      item_name = EXCLUDED.item_name,
      default_rate = EXCLUDED.default_rate,
      rates = EXCLUDED.rates,
      status = EXCLUDED.status,
      unit = EXCLUDED.unit
  `;
}

export async function dbUpdateItem(id: string, data: Partial<Item>): Promise<void> {
  await dbEnsureItems();
  const i = data as Partial<Item>;
  await sql`
    UPDATE items SET
      item_name    = COALESCE(${i.itemName ?? null}, item_name),
      default_rate = COALESCE(${i.defaultRate ?? null}, default_rate),
      rates        = COALESCE(${i.rates ? JSON.stringify(i.rates) : null}::jsonb, rates),
      status       = COALESCE(${i.status ?? null}, status),
      unit         = COALESCE(${i.unit ?? null}, unit)
    WHERE id = ${id}
  `;
}

export async function dbDeleteItem(id: string): Promise<void> {
  await dbEnsureItems();
  await sql`DELETE FROM items WHERE id = ${id}`;
}

async function dbEnsureShifts(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS shifts (
      name TEXT PRIMARY KEY,
      start_time TEXT NOT NULL DEFAULT '06:00',
      end_time TEXT NOT NULL DEFAULT '14:00',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS start_time TEXT NOT NULL DEFAULT '06:00'`;
  await sql`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS end_time TEXT NOT NULL DEFAULT '14:00'`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_name_lower ON shifts(lower(name))`;
}

export interface ShiftDefinition {
  name: string;
  startTime: string;
  endTime: string;
}

export async function dbGetShifts(): Promise<ShiftDefinition[]> {
  await dbEnsureShifts();
  const rows = await sql<{ name: string; start_time: string; end_time: string }[]>`
    SELECT name, start_time, end_time FROM shifts ORDER BY created_at, name
  `;
  return rows.map((row) => ({ name: row.name, startTime: row.start_time, endTime: row.end_time }));
}

export async function dbAddShift(shift: ShiftDefinition): Promise<void> {
  await dbEnsureShifts();
  await sql`
    INSERT INTO shifts (name, start_time, end_time)
    VALUES (${shift.name.trim()}, ${shift.startTime}, ${shift.endTime})
    ON CONFLICT (name) DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time
  `;
}

export async function dbGetOperators(): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS shift_operators (name TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = await sql<{ name: string }[]>`SELECT name FROM shift_operators ORDER BY name`;
  return rows.map((row) => row.name);
}

export async function dbAddOperator(name: string): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS shift_operators (name TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`INSERT INTO shift_operators (name) VALUES (${name.trim()}) ON CONFLICT (name) DO NOTHING`;
}

export async function dbDeleteOperator(name: string): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS shift_operators (name TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`DELETE FROM shift_operators WHERE lower(name) = ${name.trim().toLowerCase()}`;
}

export async function dbDeleteShift(name: string): Promise<void> {
  await dbEnsureShifts();
  await sql`DELETE FROM shifts WHERE lower(name) = ${name.trim().toLowerCase()}`;
}

// ─── Production Entries ───────────────────────────────────────────────────────

export async function dbGetEntries(filters?: {
  dateFrom?: string;
  dateTo?: string;
  machineId?: string;
  shift?: string;
}): Promise<ProductionEntry[]> {
  await sql`ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS opening_reading INTEGER NOT NULL DEFAULT 0`;
  const rows = await sql`
    SELECT * FROM production_entries
    WHERE
      (${filters?.dateFrom ?? null} IS NULL OR date >= ${filters?.dateFrom ?? null}::date)
      AND (${filters?.dateTo ?? null} IS NULL OR date <= ${filters?.dateTo ?? null}::date)
      AND (${filters?.machineId ?? null} IS NULL OR machine_id = ${filters?.machineId ?? null})
      AND (${filters?.shift ?? null} IS NULL OR shift = ${filters?.shift ?? null})
    ORDER BY date DESC
  `;
  return rows.map(rowToEntry);
}

export async function dbUpsertEntries(entries: ProductionEntry[]): Promise<void> {
  await sql`ALTER TABLE production_entries ADD COLUMN IF NOT EXISTS opening_reading INTEGER NOT NULL DEFAULT 0`;
  for (const e of entries) {
    await sql`
      INSERT INTO production_entries
        (id, date, machine_id, item_id, shift, opening_reading, entries, status, operator_name, notes, total_actual, total_expected)
      VALUES
        (${e.id}, ${e.date}, ${e.machineId}, ${e.itemId}, ${e.shift}, ${e.openingReading ?? 0}, ${JSON.stringify(e.entries)}, ${e.status}, ${e.operatorName}, ${e.notes}, ${e.totalActual}, ${e.totalExpected})
      ON CONFLICT (date, machine_id, shift) DO UPDATE SET
        item_id        = EXCLUDED.item_id,
        opening_reading = EXCLUDED.opening_reading,
        entries        = EXCLUDED.entries,
        status         = EXCLUDED.status,
        operator_name  = EXCLUDED.operator_name,
        notes          = EXCLUDED.notes,
        total_actual   = EXCLUDED.total_actual,
        total_expected = EXCLUDED.total_expected
    `;
  }
}

// ─── Alert Thresholds ────────────────────────────────────────────────────────

export async function dbGetAlertThresholds(): Promise<AlertThreshold[]> {
  const rows = await sql`SELECT * FROM alert_thresholds ORDER BY created_at`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    threshold: Number(r.threshold),
    enabled: r.enabled,
    notify_in_app: r.notify_in_app,
    created_at: r.created_at,
  })) as AlertThreshold[];
}

export async function dbUpsertAlertThreshold(t: Omit<AlertThreshold, 'created_at'>): Promise<void> {
  await sql`
    INSERT INTO alert_thresholds (id, name, type, threshold, enabled, notify_in_app)
    VALUES (${t.id}, ${t.name}, ${t.type}, ${t.threshold}, ${t.enabled}, ${t.notify_in_app})
    ON CONFLICT (id) DO UPDATE SET
      name          = EXCLUDED.name,
      type          = EXCLUDED.type,
      threshold     = EXCLUDED.threshold,
      enabled       = EXCLUDED.enabled,
      notify_in_app = EXCLUDED.notify_in_app
  `;
}

export async function dbDeleteAlertThreshold(id: string): Promise<void> {
  await sql`DELETE FROM alert_thresholds WHERE id = ${id}`;
}

export async function dbGetAlertEvents(limit = 50): Promise<AlertEvent[]> {
  const rows = await sql`
    SELECT * FROM alert_events ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    alert_id: r.alert_id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    message: r.message,
    machine_id: r.machine_id,
    resolved: r.resolved,
    created_at: r.created_at,
  })) as AlertEvent[];
}

export async function dbInsertAlertEvent(e: Omit<AlertEvent, 'id' | 'created_at'>): Promise<void> {
  await sql`
    INSERT INTO alert_events (alert_id, type, severity, title, message, machine_id, resolved)
    VALUES (${e.alert_id}, ${e.type}, ${e.severity}, ${e.title}, ${e.message}, ${e.machine_id}, ${e.resolved})
  `;
}

export async function dbResolveAlert(id: string): Promise<void> {
  await sql`UPDATE alert_events SET resolved = true WHERE id = ${id}`;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToMachine(r: any): Machine {
  return {
    id: r.id,
    machineType: r.machine_type,
    machineNumber: r.machine_number,
    expectedPerHour: Number(r.machine_target_rate ?? 0),
    status: r.status,
    currentItem: r.current_item,
    operatorName: r.operator_name,
    lastEntryTime: r.last_entry_time,
    assignedItems: r.assigned_items ?? [],
    createdAt: r.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(r: any): Item {
  return {
    id: r.id,
    itemName: r.item_name,
    defaultRate: Number(r.default_rate ?? 0),
    rates: r.rates ?? [],
    status: r.status,
    unit: r.unit,
    createdAt: r.created_at,
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
    openingReading: Number(r.opening_reading ?? 0),
    entries: r.entries ?? [],
    status: r.status,
    operatorName: r.operator_name,
    notes: r.notes ?? '',
    totalActual: r.total_actual,
    totalExpected: r.total_expected,
  };
}
