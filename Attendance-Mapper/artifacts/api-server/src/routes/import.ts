import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import {
  db,
  employeesTable,
  departmentsTable,
  attendanceTable,
  overtimeTable,
  leavesTable,
  payrollLinesTable,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseWorkbook(buffer: Buffer, mimetype: string): Record<string, any[][]> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, bookVBA: false, WTF: false });
  const result: Record<string, any[][]> = {};
  for (const name of wb.SheetNames) {
    try {
      result[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" }) as any[][];
    } catch {
      result[name] = [];
    }
  }
  return result;
}

function parseCsv(text: string): any[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const cells: string[] = [];
      let cur = "", inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    });
}

function normalizeHeader(h: string): string {
  return String(h).toLowerCase().replace(/[\s_\-\/\.]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function toStr(v: any): string { return v == null ? "" : String(v).trim(); }
function toNum(v: any): number { return isNaN(Number(v)) ? 0 : Number(v); }
function toBool(v: any): boolean {
  const s = toStr(v).toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1";
}
function toDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = toStr(v);
  const m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m2) {
    const y = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${y}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  return null;
}
function toTime(v: any): string | null {
  if (!v) return null;
  const s = toStr(v);
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function rowsToObjects(rows: any[][]): Record<string, any>[] {
  if (rows.length < 2) return [];
  const headers = (rows[0] as any[]).map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ""; });
    return obj;
  }).filter((r) => Object.values(r).some((v) => toStr(v)));
}

// ─── /api/import/preview ──────────────────────────────────────────────────

router.post("/import/preview", upload.single("file"), async (req, res) => {
  try {
    const { type } = req.body as { type: string };
    if (!req.file && !req.body.csv) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      if (isCsv) {
        rows = rowsToObjects(parseCsv(req.file.buffer.toString("utf8")));
      } else {
        const sheets = parseWorkbook(req.file.buffer, req.file.mimetype);
        const sheetName = Object.keys(sheets)[0];
        rows = rowsToObjects(sheets[sheetName]);
      }
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    const preview = rows.slice(0, 5);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({ total: rows.length, columns, preview });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/employees ────────────────────────────────────────────────

router.post("/import/employees", upload.single("file"), async (req, res) => {
  try {
    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      rows = isCsv
        ? rowsToObjects(parseCsv(req.file.buffer.toString("utf8")))
        : rowsToObjects(Object.values(parseWorkbook(req.file.buffer, req.file.mimetype))[0]);
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    // Build dept name → id map, create missing depts
    const depts = await db.select().from(departmentsTable);
    const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const name = toStr(row["name"] ?? row["employee_name"] ?? row["employeename"]);
        const zone = toStr(row["zone"] ?? row["department"] ?? row["department_name"] ?? row["departmentname"] ?? "General");
        const designation = toStr(row["designation"] ?? row["role"] ?? "Worker");
        const wage = toNum(row["monthly_wage"] ?? row["wage"] ?? row["salary"] ?? row["monthlywage"] ?? 0);
        const statsEligible = !toBool(row["no_pf"] ?? false);
        const otEligible = !toBool(row["no_ot"] ?? false);

        if (!code || !name) { skipped++; continue; }

        // Ensure department exists
        let deptId = deptMap.get(zone.toLowerCase());
        if (!deptId) {
          const [newDept] = await db.insert(departmentsTable).values({
            name: zone,
            displayOrder: deptMap.size + 1,
          }).returning();
          deptId = newDept.id;
          deptMap.set(zone.toLowerCase(), deptId);
        }

        const existing = await db.select({ id: employeesTable.id })
          .from(employeesTable).where(eq(employeesTable.employeeCode, code));

        if (existing.length > 0) {
          await db.update(employeesTable).set({
            name, departmentId: deptId, designation,
            monthlyWage: String(wage), statsEligible, otEligible,
          }).where(eq(employeesTable.employeeCode, code));
          updated++;
        } else {
          await db.insert(employeesTable).values({
            employeeCode: code, name, departmentId: deptId,
            designation, monthlyWage: String(wage), statsEligible, otEligible,
          });
          inserted++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({ inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/attendance ───────────────────────────────────────────────

router.post("/import/attendance", upload.single("file"), async (req, res) => {
  try {
    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      if (isCsv) {
        rows = rowsToObjects(parseCsv(req.file.buffer.toString("utf8")));
      } else {
        // Excel: try to find an attendance sheet, else use first
        const sheets = parseWorkbook(req.file.buffer, req.file.mimetype);
        const attSheet = Object.keys(sheets).find((s) =>
          s.toLowerCase().includes("attend") || s.toLowerCase().includes("punch") || /^\d{2}$/.test(s)
        ) ?? Object.keys(sheets)[0];
        rows = rowsToObjects(sheets[attSheet]);
      }
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    // Build emp code → id map
    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    const VALID_STATUSES = new Set(["present", "absent", "late", "half_day", "on_leave"]);

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const date = toDate(row["date"] ?? row["attendance_date"] ?? row["day"]);
        if (!code || !date) { skipped++; continue; }

        const empId = empMap.get(code.toLowerCase());
        if (!empId) { errors.push(`Row ${i + 2}: Employee ${code} not found`); skipped++; continue; }

        let status = toStr(row["status"] ?? row["attendance_status"] ?? "present").toLowerCase();
        if (!VALID_STATUSES.has(status)) status = "present";

        const inTime1  = toTime(row["in_time1"]  ?? row["in1"]  ?? row["checkin"]  ?? row["punch_in"]  ?? row["intime1"]);
        const outTime1 = toTime(row["out_time1"] ?? row["out1"] ?? row["checkout"] ?? row["punch_out"] ?? row["outtime1"]);
        const inTime2  = toTime(row["in_time2"]  ?? row["in2"]  ?? row["intime2"]);
        const outTime2 = toTime(row["out_time2"] ?? row["out2"] ?? row["outtime2"]);
        const hoursWorked = row["hours_worked"] ?? row["hours"] ?? row["hoursworked"] ?? null;
        const note = toStr(row["note"] ?? row["notes"] ?? row["remark"] ?? "");

        const payload = {
          employeeId: empId, date, status,
          inTime1: inTime1 || null, outTime1: outTime1 || null,
          inTime2: inTime2 || null, outTime2: outTime2 || null,
          hoursWorked: hoursWorked != null ? String(toNum(hoursWorked)) : null,
          note: note || null,
        };

        const existing = await db.select({ employeeId: attendanceTable.employeeId })
          .from(attendanceTable)
          .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));

        if (existing.length > 0) {
          await db.update(attendanceTable).set(payload)
            .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));
          updated++;
        } else {
          await db.insert(attendanceTable).values(payload);
          inserted++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({ inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/overtime ─────────────────────────────────────────────────

router.post("/import/overtime", upload.single("file"), async (req, res) => {
  try {
    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      rows = isCsv
        ? rowsToObjects(parseCsv(req.file.buffer.toString("utf8")))
        : rowsToObjects(Object.values(parseWorkbook(req.file.buffer, req.file.mimetype))[0]);
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));

    let inserted = 0, skipped = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const date = toDate(row["date"] ?? row["ot_date"] ?? row["overtime_date"]);
        const hours = toNum(row["hours"] ?? row["ot_hours"] ?? row["overtime_hours"] ?? 0);
        const reason = toStr(row["reason"] ?? row["note"] ?? "");

        if (!code || !date || hours <= 0) { skipped++; continue; }
        const empId = empMap.get(code.toLowerCase());
        if (!empId) { errors.push(`Row ${i + 2}: Employee ${code} not found`); skipped++; continue; }

        await db.insert(overtimeTable).values({
          employeeId: empId, date, hours: String(hours), reason: reason || null,
        });
        inserted++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({ inserted, skipped, errors, total: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/leaves ───────────────────────────────────────────────────

router.post("/import/leaves", upload.single("file"), async (req, res) => {
  try {
    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      rows = isCsv
        ? rowsToObjects(parseCsv(req.file.buffer.toString("utf8")))
        : rowsToObjects(Object.values(parseWorkbook(req.file.buffer, req.file.mimetype))[0]);
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));

    let inserted = 0, skipped = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const startDate = toDate(row["start_date"] ?? row["from_date"] ?? row["leave_start"] ?? row["startdate"]);
        const endDate = toDate(row["end_date"] ?? row["to_date"] ?? row["leave_end"] ?? row["enddate"] ?? startDate);
        const leaveType = toStr(row["leave_type"] ?? row["type"] ?? row["leavetype"] ?? "casual");
        const reason = toStr(row["reason"] ?? row["note"] ?? "");
        const status = toStr(row["status"] ?? "approved").toLowerCase();

        if (!code || !startDate) { skipped++; continue; }
        const empId = empMap.get(code.toLowerCase());
        if (!empId) { errors.push(`Row ${i + 2}: Employee ${code} not found`); skipped++; continue; }

        await db.insert(leavesTable).values({
          employeeId: empId, leaveType, startDate, endDate: endDate!, reason: reason || null,
          status: ["pending","approved","rejected"].includes(status) ? status : "approved",
        });
        inserted++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({ inserted, skipped, errors, total: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/payroll ──────────────────────────────────────────────────

router.post("/import/payroll", upload.single("file"), async (req, res) => {
  try {
    let rows: Record<string, any>[];
    if (req.file) {
      const isCsv = req.file.mimetype.includes("csv") || req.file.originalname.endsWith(".csv");
      rows = isCsv
        ? rowsToObjects(parseCsv(req.file.buffer.toString("utf8")))
        : rowsToObjects(Object.values(parseWorkbook(req.file.buffer, req.file.mimetype))[0]);
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv));
    }

    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));

    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const month = toStr(row["month"] ?? row["payroll_month"] ?? "");
        if (!code || !month.match(/^\d{4}-\d{2}$/)) { skipped++; continue; }

        const empId = empMap.get(code.toLowerCase());
        if (!empId) { errors.push(`Row ${i + 2}: Employee ${code} not found`); skipped++; continue; }

        const payload = {
          employeeId: empId, month,
          openingAdvance: String(toNum(row["opening_advance"] ?? row["openingadvance"] ?? 0)),
          advanceBank:    String(toNum(row["advance_bank"]    ?? row["advancebank"]    ?? 0)),
          advanceCash:    String(toNum(row["advance_cash"]    ?? row["advancecash"]    ?? 0)),
          hraElec:        String(toNum(row["hra_elec"]        ?? row["hraelec"]        ?? row["hra"] ?? 0)),
          closingAdvance: String(toNum(row["closing_advance"] ?? row["closingadvance"] ?? 0)),
          balanceCheque:  String(toNum(row["balance_cheque"]  ?? row["balancecheque"]  ?? 0)),
          notes:          toStr(row["notes"] ?? row["note"] ?? "") || null,
        };

        const existing = await db.select({ id: payrollLinesTable.id })
          .from(payrollLinesTable)
          .where(and(eq(payrollLinesTable.employeeId, empId), eq(payrollLinesTable.month, month)));

        if (existing.length > 0) {
          await db.update(payrollLinesTable).set(payload)
            .where(and(eq(payrollLinesTable.employeeId, empId), eq(payrollLinesTable.month, month)));
          updated++;
        } else {
          await db.insert(payrollLinesTable).values(payload);
          inserted++;
        }
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    res.json({ inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── /api/import/xlsx-bulk ── parse entire .xlsm and auto-route ──────────

router.post("/import/xlsx-bulk", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let sheets: Record<string, any[][]>;
    try {
      sheets = parseWorkbook(req.file.buffer, req.file.mimetype);
    } catch (parseErr: any) {
      return res.status(400).json({ error: `Failed to parse file: ${parseErr.message}` });
    }

    const summary: Record<string, any> = {};

  // Identify sheet roles
  const masterSheet = Object.keys(sheets).find((s) => s.toLowerCase() === "master" || s.toLowerCase() === "mastersheet");
  const consolidatedSheet = Object.keys(sheets).find((s) => s.toLowerCase().startsWith("consolidated") && !s.includes("2"));
  const dailySheets = Object.keys(sheets).filter((s) => /^\d{2}$/.test(s));

  // Import employees from Master sheet
  if (masterSheet) {
    const rows = rowsToObjects(sheets[masterSheet]);
    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));
    const depts = await db.select().from(departmentsTable);
    const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));

    let ins = 0, upd = 0, skip = 0;
    for (const row of rows) {
      const code = toStr(row["employee_code"] ?? row["code"] ?? row["sr_no"] ?? row["sno"] ?? "");
      const name = toStr(row["name"] ?? row["employee_name"] ?? "");
      const zone = toStr(row["zone"] ?? row["department"] ?? row["section"] ?? "General");
      const wage = toNum(row["monthly_wage"] ?? row["basic"] ?? row["wage"] ?? row["salary"] ?? 0);
      if (!code || !name) { skip++; continue; }

      let deptId = deptMap.get(zone.toLowerCase());
      if (!deptId) {
        const [nd] = await db.insert(departmentsTable).values({ name: zone, displayOrder: deptMap.size + 1 }).returning();
        deptId = nd.id; deptMap.set(zone.toLowerCase(), deptId);
      }
      if (empMap.has(code.toLowerCase())) {
        await db.update(employeesTable).set({ name, departmentId: deptId, monthlyWage: String(wage) }).where(eq(employeesTable.employeeCode, code));
        upd++;
      } else {
        await db.insert(employeesTable).values({ employeeCode: code, name, departmentId: deptId, designation: "Worker", monthlyWage: String(wage) }).catch(() => { skip++; });
        ins++;
      }
    }
    summary["master_employees"] = { inserted: ins, updated: upd, skipped: skip };
  }

  // Import attendance from daily sheets (01–28)
  if (dailySheets.length > 0) {
    const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
    const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));
    const month = req.body.month as string;
    if (!month) {
      summary["daily_attendance"] = { error: "month param required (YYYY-MM) for daily sheet import" };
    } else {
      let ins = 0, upd = 0, skip = 0;
      for (const sheetName of dailySheets) {
        const day = sheetName.padStart(2, "0");
        const date = `${month}-${day}`;
        const rows = rowsToObjects(sheets[sheetName]);
        for (const row of rows) {
          const name = toStr(row["name"] ?? row["employee_name"] ?? "");
          const empEntry = [...empMap.entries()].find(([_, id]) => {
            return emps.find((e) => e.id === id && e.code.toLowerCase() === name.toLowerCase());
          }) ?? emps.find((e) => e.code.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(e.code.toLowerCase()));

          const empId = empEntry ? (typeof empEntry === "object" && "id" in empEntry ? (empEntry as any).id : empEntry[1]) : null;
          if (!empId) { skip++; continue; }

          const inTime1  = toTime(row["in_time1"]  ?? row["in1"]  ?? row["c"] ?? row["check_in"]);
          const outTime1 = toTime(row["out_time1"] ?? row["out1"] ?? row["d"] ?? row["check_out"]);
          const hoursWorked = toStr(row["hours_worked"] ?? row["g"] ?? row["hours"] ?? "");

          const payload = {
            employeeId: empId, date,
            status: inTime1 ? "present" : "absent",
            inTime1: inTime1 || null, outTime1: outTime1 || null,
            hoursWorked: hoursWorked ? String(toNum(hoursWorked)) : null,
          };

          const existing = await db.select({ employeeId: attendanceTable.employeeId })
            .from(attendanceTable)
            .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));

          if (existing.length > 0) {
            await db.update(attendanceTable).set(payload)
              .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));
            upd++;
          } else {
            await db.insert(attendanceTable).values(payload as any).catch(() => { skip++; });
            ins++;
          }
        }
      }
      summary["daily_attendance"] = { sheets: dailySheets.length, inserted: ins, updated: upd, skipped: skip };
    }
  }

    res.json({ summary, sheetsFound: Object.keys(sheets) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Import failed" });
  }
});

// ─── /api/import/xlsx-bulk — fix: wrap entire handler in try/catch with explicit json response ──

// (already defined above, adding delete routes below)

// ─── DELETE routes ─────────────────────────────────────────────────────────

// Delete all attendance for a month
router.delete("/data/attendance", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: "month param required (YYYY-MM)" });
    }
    const start = `${month}-01`;
    const end = `${month}-31`;
    const result = await db.delete(attendanceTable)
      .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)));
    res.json({ deleted: true, month });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all overtime for a month
router.delete("/data/overtime", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: "month param required (YYYY-MM)" });
    }
    const start = `${month}-01`;
    const end = `${month}-31`;
    await db.delete(overtimeTable)
      .where(and(gte(overtimeTable.date, start), lte(overtimeTable.date, end)));
    res.json({ deleted: true, month });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single employee
router.delete("/data/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid employee id" });
    await db.delete(attendanceTable).where(eq(attendanceTable.employeeId, id));
    await db.delete(overtimeTable).where(eq(overtimeTable.employeeId, id));
    await db.delete(leavesTable).where(eq(leavesTable.employeeId, id));
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.employeeId, id));
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    res.json({ deleted: true, employeeId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ALL employees (nuclear option)
router.delete("/data/employees", async (req, res) => {
  try {
    const { confirm } = req.query as { confirm?: string };
    if (confirm !== "yes") {
      return res.status(400).json({ error: "Pass ?confirm=yes to delete all employees" });
    }
    await db.delete(payrollLinesTable);
    await db.delete(leavesTable);
    await db.delete(overtimeTable);
    await db.delete(attendanceTable);
    await db.delete(employeesTable);
    res.json({ deleted: true, message: "All employees and related data deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete payroll lines for a month
router.delete("/data/payroll", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: "month param required (YYYY-MM)" });
    }
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.month, month));
    res.json({ deleted: true, month });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
