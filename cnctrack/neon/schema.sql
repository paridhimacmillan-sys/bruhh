-- MachineTrack — Neon PostgreSQL Schema
-- 1. Go to https://console.neon.tech → your project → SQL Editor
-- 2. Paste this entire file and click Run

-- ─── Machines ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machines (
  id              TEXT PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  machine_type    TEXT NOT NULL,
  machine_number  TEXT NOT NULL,
  machine_target_rate INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','idle','maintenance','offline')),
  current_item    TEXT,
  operator_name   TEXT,
  last_entry_time TEXT,
  assigned_items  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS machine_target_rate INTEGER;
ALTER TABLE machines
  ALTER COLUMN machine_target_rate DROP DEFAULT;
ALTER TABLE machines
  DROP CONSTRAINT IF EXISTS machines_machine_number_key;
DROP INDEX IF EXISTS idx_machines_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_org_number_unique
  ON machines(organization_id, lower(machine_number));

-- ─── Items ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  item_name    TEXT NOT NULL,
  default_rate INTEGER NOT NULL,
  rates        JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive')),
  unit         TEXT NOT NULL DEFAULT 'pcs/hr',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE items
  ALTER COLUMN default_rate DROP DEFAULT;

-- ─── Production Entries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_entries (
  id             TEXT PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  date           DATE NOT NULL,
  machine_id     TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  shift          TEXT NOT NULL,
  opening_reading INTEGER NOT NULL DEFAULT 0,
  entries        JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','flagged')),
  operator_name  TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  total_actual   INTEGER NOT NULL DEFAULT 0,
  total_expected INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, date, machine_id, shift)
);
ALTER TABLE production_entries
  DROP CONSTRAINT IF EXISTS production_entries_shift_check;
ALTER TABLE production_entries
  DROP CONSTRAINT IF EXISTS production_entries_date_machine_id_shift_key;
ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE production_entries
  ADD COLUMN IF NOT EXISTS opening_reading INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_entries_date    ON production_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_machine ON production_entries(machine_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_org_date_machine_shift_unique
  ON production_entries(organization_id, date, machine_id, shift);

-- Configurable shifts
CREATE TABLE IF NOT EXISTS shifts (
  name       TEXT PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  start_time TEXT NOT NULL DEFAULT '06:00',
  end_time   TEXT NOT NULL DEFAULT '14:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_pkey;
DROP INDEX IF EXISTS idx_shifts_name_lower;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_org_name_unique ON shifts(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_shifts_org_name_lower ON shifts(organization_id, lower(name));

CREATE TABLE IF NOT EXISTS shift_operators (
  name       TEXT NOT NULL,
  organization_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE shift_operators
  ADD COLUMN IF NOT EXISTS organization_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shift_operators
  DROP CONSTRAINT IF EXISTS shift_operators_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_operators_org_name_unique
  ON shift_operators(organization_id, name);

-- ─── Alert Thresholds ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_thresholds (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL
                  CHECK (type IN ('efficiency_below','hourly_gap_above','machine_down','flagged_entry')),
  threshold     NUMERIC NOT NULL DEFAULT 0,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Alert Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   TEXT REFERENCES alert_thresholds(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  machine_id TEXT,
  resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_resolved ON alert_events(resolved);

-- Shared users/roles table for cross-app auth (CNC + Rejection Mapper)
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  organization_id INTEGER,
  provider TEXT NOT NULL DEFAULT 'google',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS organization_id INTEGER;

