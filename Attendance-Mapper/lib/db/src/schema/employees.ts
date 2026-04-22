import { pgTable, serial, text, timestamp, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { departmentsTable } from "./departments";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeCode: text("employee_code").notNull().unique(),
  name: text("name").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departmentsTable.id, { onDelete: "restrict" }),
  designation: text("designation").notNull(),
  monthlyWage: numeric("monthly_wage", { precision: 10, scale: 2 }).notNull().default("0"),
  statsEligible: boolean("stats_eligible").notNull().default(true),
  otEligible: boolean("ot_eligible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeRow = typeof employeesTable.$inferSelect;
