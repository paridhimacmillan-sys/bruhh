-- MachineTrack — Neon PostgreSQL Schema
-- 1. Go to https://console.neon.tech → your project → SQL Editor
-- 2. Paste this entire file and click Run

-- ─── Machines ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machines (
  id              TEXT PRIMARY KEY,
  machine_type    TEXT NOT NULL,
  machine_number  TEXT NOT NULL UNIQUE,
  machine_target_rate INTEGER NOT NULL DEFAULT 60,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','idle','maintenance','offline')),
  current_item    TEXT,
  operator_name   TEXT,
  last_entry_time TEXT,
  assigned_items  JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS machine_target_rate INTEGER NOT NULL DEFAULT 60;

-- ─── Items ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  item_name    TEXT NOT NULL,
  default_rate INTEGER NOT NULL DEFAULT 60,
  rates        JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive')),
  unit         TEXT NOT NULL DEFAULT 'pcs/hr',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Production Entries ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_entries (
  id             TEXT PRIMARY KEY,
  date           DATE NOT NULL,
  machine_id     TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  shift          TEXT NOT NULL,
  entries        JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','submitted','flagged')),
  operator_name  TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  total_actual   INTEGER NOT NULL DEFAULT 0,
  total_expected INTEGER NOT NULL DEFAULT 0,
  UNIQUE (date, machine_id, shift)
);
ALTER TABLE production_entries
  DROP CONSTRAINT IF EXISTS production_entries_shift_check;

CREATE INDEX IF NOT EXISTS idx_entries_date    ON production_entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_machine ON production_entries(machine_id);

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
  provider TEXT NOT NULL DEFAULT 'google',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

