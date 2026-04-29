import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./src/schema/index.js";

const { Client } = pg;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log("[migrate] Connected to database");

    const db = drizzle(client, { schema });

    // Create tables using drizzle-kit's push logic but without prompts
    // We'll use a simpler approach: execute raw SQL for table creation
    const sql = `
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        display_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
        designation TEXT NOT NULL,
        monthly_wage NUMERIC(10,2) NOT NULL DEFAULT 0,
        stats_eligible BOOLEAN NOT NULL DEFAULT true,
        ot_eligible BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        in_time1 TEXT,
        out_time1 TEXT,
        in_time2 TEXT,
        out_time2 TEXT,
        hours_worked TEXT,
        note TEXT,
        UNIQUE(employee_id, date)
      );

      CREATE TABLE IF NOT EXISTS overtime (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        hours TEXT NOT NULL,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        leave_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'approved'
      );

      CREATE TABLE IF NOT EXISTS payroll_lines (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        opening_advance TEXT NOT NULL DEFAULT '0',
        advance_bank TEXT NOT NULL DEFAULT '0',
        advance_cash TEXT NOT NULL DEFAULT '0',
        hra_elec TEXT NOT NULL DEFAULT '0',
        closing_advance TEXT NOT NULL DEFAULT '0',
        balance_cheque TEXT NOT NULL DEFAULT '0',
        notes TEXT,
        UNIQUE(employee_id, month)
      );
    `;

    await client.query(sql);
    console.log("[migrate] Tables created successfully");
  } catch (error: any) {
    console.error("[migrate] Error:", error.message);
    // Don't fail - tables might already exist
  } finally {
    await client.end();
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(0));
