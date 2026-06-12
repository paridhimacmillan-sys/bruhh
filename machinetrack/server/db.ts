import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export let pool: pg.Pool;
export let db: NodePgDatabase<typeof schema>;

export async function initDb(): Promise<void> {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Sanity-check the connection before anything else uses the pool.
  await pool.query("SELECT 1");

  db = drizzle(pool, { schema });

  await runMigrations();
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

    CREATE TABLE IF NOT EXISTS "organizations" (
      "id" serial PRIMARY KEY,
      "name" text NOT NULL,
      "invite_code" text NOT NULL UNIQUE,
      "created_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY,
      "email" text,
      "username" text UNIQUE,
      "password" text NOT NULL,
      "role" text NOT NULL DEFAULT 'employee',
      "organization_id" integer REFERENCES "organizations"("id"),
      "created_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "machines" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "machine_number" text NOT NULL,
      "machine_type" text NOT NULL,
      "target_rate" integer NOT NULL DEFAULT 60,
      "status" text NOT NULL DEFAULT 'active',
      "created_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "items" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "item_name" text NOT NULL,
      "default_rate" integer NOT NULL DEFAULT 60,
      "rates" jsonb DEFAULT '[]',
      "status" text NOT NULL DEFAULT 'active',
      "unit" text DEFAULT 'pcs/hr'
    );

    CREATE TABLE IF NOT EXISTS "shifts" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "name" text NOT NULL,
      "start_time" text NOT NULL,
      "end_time" text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "operators" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "name" text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "alert_thresholds" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "name" text NOT NULL,
      "type" text NOT NULL,
      "threshold" integer NOT NULL,
      "scope" text NOT NULL DEFAULT 'machine',
      "enabled" boolean NOT NULL DEFAULT true,
      "created_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS "production_entries" (
      "id" serial PRIMARY KEY,
      "organization_id" integer NOT NULL REFERENCES "organizations"("id"),
      "date" date NOT NULL,
      "machine_id" integer NOT NULL REFERENCES "machines"("id"),
      "item_id" integer REFERENCES "items"("id"),
      "shift" text NOT NULL,
      "opening_reading" integer DEFAULT 0,
      "entries" jsonb NOT NULL,
      "operator_name" text,
      "notes" text,
      "locked_hours" integer[] DEFAULT '{}',
      "total_actual" integer DEFAULT 0,
      "total_expected" integer DEFAULT 0,
      "status" text DEFAULT 'draft',
      "updated_at" timestamp NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "IDX_production_unique"
      ON "production_entries" ("organization_id", "date", "machine_id", "shift");

    CREATE INDEX IF NOT EXISTS "IDX_machines_org" ON "machines" ("organization_id");
    CREATE INDEX IF NOT EXISTS "IDX_items_org" ON "items" ("organization_id");
    CREATE INDEX IF NOT EXISTS "IDX_shifts_org" ON "shifts" ("organization_id");
    CREATE INDEX IF NOT EXISTS "IDX_operators_org" ON "operators" ("organization_id");
  `);
}
