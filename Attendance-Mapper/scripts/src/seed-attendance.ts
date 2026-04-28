import {
  db,
  departmentsTable,
  employeesTable,
  attendanceTable,
  overtimeTable,
  leavesTable,
  payrollLinesTable,
} from "@workspace/db";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log("Clearing data...");
  await db.delete(payrollLinesTable);
  await db.delete(attendanceTable);
  await db.delete(overtimeTable);
  await db.delete(leavesTable);
  await db.delete(employeesTable);
  await db.delete(departmentsTable);

  console.log("Seeding zones (1-7)...");
  const zoneSpecs = [
    { name: "Pin Production", code: "ZONE 1" },
    { name: "Polish & Plating", code: "ZONE 2" },
    { name: "Quality Control", code: "ZONE 3" },
    { name: "Packing", code: "ZONE 4" },
    { name: "Maintenance", code: "ZONE 5" },
    { name: "Stores", code: "ZONE 6" },
    { name: "Office", code: "ZONE 7" },
  ];
  const depts = await db
    .insert(departmentsTable)
    .values(zoneSpecs.map((z, i) => ({ name: z.name, code: z.code, displayOrder: i + 1 })))
    .returning();

  const designations = ["Operator", "Supervisor", "Technician", "Helper", "Lead", "Clerk"];
  const firstNames = [
    "Ravi", "Anita", "Suresh", "Priya", "Manoj", "Kavita", "Deepak", "Pooja",
    "Vinod", "Sneha", "Arun", "Meena", "Rajesh", "Lakshmi", "Amit", "Geeta",
    "Sanjay", "Neha", "Vijay", "Asha", "Kamta", "Bharat", "Ramesh", "Sunita",
  ];
  const lastNames = ["Kumar", "Singh", "Sharma", "Patel", "Reddy", "Nair", "Yadav", "Verma"];

  console.log("Seeding employees with wage/STATS/OT flags...");
  const employees: {
    departmentId: number;
    employeeCode: string;
    name: string;
    designation: string;
    monthlyWage: string;
    statsEligible: boolean;
    otEligible: boolean;
  }[] = [];
  let codeNum = 1;
  for (const d of depts) {
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
      const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
      const designation = designations[Math.floor(Math.random() * designations.length)];
      const baseWage =
        designation === "Lead" || designation === "Supervisor" ? 18000 :
        designation === "Technician" ? 14000 :
        designation === "Operator" ? 12000 :
        designation === "Clerk" ? 13000 :
        10500;
      const monthlyWage = (baseWage + Math.floor(Math.random() * 2000)).toFixed(2);
      employees.push({
        departmentId: d.id,
        employeeCode: `Z${String(codeNum++).padStart(3, "0")}`,
        name: `${fn} ${ln}`,
        designation,
        monthlyWage,
        statsEligible: Math.random() < 0.85,
        otEligible: Math.random() < 0.9,
      });
    }
  }
  const insertedEmployees = await db.insert(employeesTable).values(employees).returning();

  console.log("Seeding attendance for past 30 days (with punches)...");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const attendanceRows: {
    employeeId: number;
    date: string;
    status: string;
    inTime1: string | null;
    outTime1: string | null;
    inTime2: string | null;
    outTime2: string | null;
    hoursWorked: string | null;
    note: string | null;
  }[] = [];
  for (let day = 30; day >= 1; day--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - day);
    if (d.getUTCDay() === 0) continue;
    const dateStr = fmt(d);
    for (const emp of insertedEmployees) {
      const r = Math.random();
      let status: string;
      let inTime1: string | null = null,
        outTime1: string | null = null,
        inTime2: string | null = null,
        outTime2: string | null = null,
        hoursWorked: string | null = null;
      if (r < 0.82) {
        status = "present";
        inTime1 = "09:00"; outTime1 = "13:00"; inTime2 = "13:30"; outTime2 = "17:30";
        hoursWorked = "8.00";
      } else if (r < 0.88) {
        status = "late";
        inTime1 = "09:30"; outTime1 = "13:00"; inTime2 = "13:30"; outTime2 = "17:30";
        hoursWorked = "7.50";
      } else if (r < 0.92) {
        status = "half_day";
        inTime1 = "09:00"; outTime1 = "13:00";
        hoursWorked = "4.00";
      } else {
        status = "absent";
      }
      attendanceRows.push({ employeeId: emp.id, date: dateStr, status, inTime1, outTime1, inTime2, outTime2, hoursWorked, note: null });
    }
  }
  for (let i = 0; i < attendanceRows.length; i += 500) {
    await db.insert(attendanceTable).values(attendanceRows.slice(i, i + 500));
  }

  console.log("Seeding overtime entries...");
  const otRows: { employeeId: number; date: string; hours: string; reason: string | null }[] = [];
  for (let i = 0; i < 25; i++) {
    const emp = insertedEmployees[Math.floor(Math.random() * insertedEmployees.length)];
    const daysAgo = Math.floor(Math.random() * 25) + 1;
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    otRows.push({
      employeeId: emp.id,
      date: fmt(d),
      hours: (Math.floor(Math.random() * 4) + 1).toFixed(1),
      reason: ["Production target", "Equipment downtime recovery", "Weekly maintenance", "Special order"][Math.floor(Math.random() * 4)],
    });
  }
  await db.insert(overtimeTable).values(otRows);

  console.log("Seeding leave requests...");
  const leaveTypes = ["CL", "SL", "EL", "LOP"];
  const statuses = ["pending", "approved", "approved", "rejected"];
  const leaveRows: { employeeId: number; leaveType: string; startDate: string; endDate: string; reason: string | null; status: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const emp = insertedEmployees[Math.floor(Math.random() * insertedEmployees.length)];
    const startDaysAgo = Math.floor(Math.random() * 40) - 10;
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() + startDaysAgo);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + Math.floor(Math.random() * 3));
    leaveRows.push({
      employeeId: emp.id,
      leaveType: leaveTypes[Math.floor(Math.random() * leaveTypes.length)],
      startDate: fmt(start),
      endDate: fmt(end),
      reason: ["Family function", "Medical", "Personal work", "Travel"][Math.floor(Math.random() * 4)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
    });
  }
  await db.insert(leavesTable).values(leaveRows);

  console.log("Done!");
  console.log(`  ${depts.length} zones`);
  console.log(`  ${insertedEmployees.length} employees`);
  console.log(`  ${attendanceRows.length} attendance records`);
  console.log(`  ${otRows.length} overtime entries`);
  console.log(`  ${leaveRows.length} leave requests`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
