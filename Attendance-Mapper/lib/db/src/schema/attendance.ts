import { pgTable, integer, text, timestamp, date, primaryKey, numeric } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const attendanceTable = pgTable(
  "attendance",
  {
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: text("status").notNull(),
    inTime1: text("in_time_1"),
    outTime1: text("out_time_1"),
    inTime2: text("in_time_2"),
    outTime2: text("out_time_2"),
    hoursWorked: numeric("hours_worked", { precision: 5, scale: 2 }),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.employeeId, t.date] })],
);

export type AttendanceRow = typeof attendanceTable.$inferSelect;
