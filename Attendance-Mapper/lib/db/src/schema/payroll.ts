import { pgTable, serial, integer, text, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const payrollLinesTable = pgTable(
  "payroll_lines",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    openingAdvance: numeric("opening_advance", { precision: 10, scale: 2 }).notNull().default("0"),
    advanceBank: numeric("advance_bank", { precision: 10, scale: 2 }).notNull().default("0"),
    advanceCash: numeric("advance_cash", { precision: 10, scale: 2 }).notNull().default("0"),
    hraElec: numeric("hra_elec", { precision: 10, scale: 2 }).notNull().default("0"),
    closingAdvance: numeric("closing_advance", { precision: 10, scale: 2 }).notNull().default("0"),
    balanceCheque: numeric("balance_cheque", { precision: 10, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payroll_lines_emp_month_idx").on(t.employeeId, t.month)],
);

export type PayrollLineRow = typeof payrollLinesTable.$inferSelect;
