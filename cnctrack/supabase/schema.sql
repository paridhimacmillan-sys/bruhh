-- CNCTrack — Supabase Schema
-- Run this in your Supabase project's SQL editor (Database → SQL Editor → New query)
-- Tables use snake_case columns; the app layer maps them to camelCase.

-- ─── Machines ───────────────────────────────────────────────────────────────
create table if not exists machines (
  id              text primary key,
  machine_type    text not null,
  machine_number  text not null unique,
  status          text not null default 'active'
                    check (status in ('active','idle','maintenance','offline')),
  current_item    text,
  operator_name   text,
  last_entry_time text,
  assigned_items  jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

-- ─── Items ──────────────────────────────────────────────────────────────────
create table if not exists items (
  id           text primary key,
  item_name    text not null,
  default_rate integer not null default 60,
  rates        jsonb not null default '[]',   -- [{machineId, rate}]
  status       text not null default 'active'
                 check (status in ('active','inactive')),
  unit         text not null default 'pcs/hr',
  created_at   timestamptz not null default now()
);

-- ─── Production Entries ──────────────────────────────────────────────────────
create table if not exists production_entries (
  id             text primary key,
  date           date not null,
  machine_id     text not null references machines(id) on delete cascade,
  item_id        text not null references items(id) on delete restrict,
  shift          text not null check (shift in ('A','B','C')),
  entries        jsonb not null default '[]',  -- [{hour, actual, expected}]
  status         text not null default 'draft'
                   check (status in ('draft','submitted','flagged')),
  operator_name  text not null default '',
  notes          text not null default '',
  total_actual   integer not null default 0,
  total_expected integer not null default 0,
  unique (date, machine_id, shift)
);

create index if not exists idx_entries_date     on production_entries(date);
create index if not exists idx_entries_machine  on production_entries(machine_id);

-- ─── Alert Thresholds ────────────────────────────────────────────────────────
create table if not exists alert_thresholds (
  id            text primary key,
  name          text not null,
  type          text not null
                  check (type in ('efficiency_below','hourly_gap_above','machine_down','flagged_entry')),
  threshold     numeric not null default 0,
  enabled       boolean not null default true,
  notify_in_app boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ─── Alert Events ────────────────────────────────────────────────────────────
create table if not exists alert_events (
  id         uuid primary key default gen_random_uuid(),
  alert_id   text references alert_thresholds(id) on delete set null,
  type       text not null,
  severity   text not null check (severity in ('info','warning','critical')),
  title      text not null,
  message    text not null,
  machine_id text,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_alert_events_resolved on alert_events(resolved);

-- ─── Seed data (optional — comment out if seeding from the app) ──────────────
-- insert into machines (id, machine_type, machine_number, status, current_item, operator_name, assigned_items) values
--   ('machine-cnc1','CNC Lathe','CNC1','active','item-a','Amit Sharma','["item-a","item-b","item-d"]'),
--   ('machine-cnc2','CNC Milling','CNC2','active','item-b','Priya Nair','["item-b","item-c"]'),
--   ('machine-cnc3','CNC Lathe','CNC3','maintenance',null,null,'["item-a","item-c","item-e"]'),
--   ('machine-cnc4','CNC Turning','CNC4','active','item-c','Suresh Patel','["item-c","item-d","item-e"]'),
--   ('machine-cnc5','CNC Grinding','CNC5','idle','item-e','Deepa Menon','["item-d","item-e"]'),
--   ('machine-cnc6','CNC Drilling','CNC6','offline',null,null,'["item-a","item-f"]');

-- insert into items (id, item_name, default_rate, rates, status, unit) values
--   ('item-a','Spindle Shaft — Type A',80,'[{"machineId":"machine-cnc1","rate":80},{"machineId":"machine-cnc3","rate":70},{"machineId":"machine-cnc6","rate":75}]','active','pcs/hr'),
--   ('item-b','Bearing Housing — B200',60,'[{"machineId":"machine-cnc1","rate":65},{"machineId":"machine-cnc2","rate":60}]','active','pcs/hr'),
--   ('item-c','Valve Body — VB-40',45,'[{"machineId":"machine-cnc2","rate":48},{"machineId":"machine-cnc3","rate":42},{"machineId":"machine-cnc4","rate":45}]','active','pcs/hr'),
--   ('item-d','Coupling Flange — CF-12',90,'[{"machineId":"machine-cnc1","rate":90},{"machineId":"machine-cnc4","rate":88},{"machineId":"machine-cnc5","rate":85}]','active','pcs/hr'),
--   ('item-e','Gear Blank — GB-55',55,'[{"machineId":"machine-cnc3","rate":52},{"machineId":"machine-cnc4","rate":55},{"machineId":"machine-cnc5","rate":58}]','active','pcs/hr'),
--   ('item-f','Nozzle Insert — NI-08',120,'[{"machineId":"machine-cnc6","rate":120}]','inactive','pcs/hr');
