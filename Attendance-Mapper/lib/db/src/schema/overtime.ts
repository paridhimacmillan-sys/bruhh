import { pgTable, serial, integer, text, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const overtimeTable = pgTable("overtime", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 5, scale: 2 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OvertimeRow = typeof overtimeTable.$inferSelect;
