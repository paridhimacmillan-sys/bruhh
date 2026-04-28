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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * safeJson — always ends the response with a valid JSON body.
 * Prevents "Unexpected end of JSON input" on the client by ensuring
 * we never let a response close without sending data.
 */
function safeJson(res: any, data: any, status = 200) {
  if (res.headersSent) return;
  return res.status(status).json(data);
}

function parseWorkbook(buffer: Buffer, _mimetype: string): Record<string, any[][]> {
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

/** Parse rows from either uploaded file or raw CSV body */
function getRows(file: Express.Multer.File | undefined, body: any): Record<string, any>[] {
  if (file) {
    const isCsv = file.mimetype.includes("csv") || file.originalname.endsWith(".csv");
    return isCsv
      ? rowsToObjects(parseCsv(file.buffer.toString("utf8")))
      : rowsToObjects(Object.values(parseWorkbook(file.buffer, file.mimetype))[0]);
  }
  if (body.csv) return rowsToObjects(parseCsv(body.csv));
  return [];
}

// ─── /api/import/preview ──────────────────────────────────────────────────

router.post("/import/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file && !req.body.csv) return safeJson(res, { error: "No file uploaded" }, 400);
    const rows = getRows(req.file, req.body);
    return safeJson(res, {
      total: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      preview: rows.slice(0, 5),
    });
  } catch (err: any) {
    return safeJson(res, { error: err?.message ?? "Preview failed" }, 400);
  }
});

// ─── /api/import/employees ────────────────────────────────────────────────

router.post("/import/employees", upload.single("file"), async (req, res) => {
  try {
    const rows = getRows(req.file, req.body);
    const depts = await db.select().from(departmentsTable);
    const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));
    let inserted = 0, updated = 0, skipped = 0;
    const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      try {
        const code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"]);
        const name = toStr(row["name"] ?? row["employee_name"] ?? row["employeename"]);
        const zone = toStr(row["zone"] ?? row["department"] ?? row["department_name"] ?? "General");
        const designation = toStr(row["designation"] ?? row["role"] ?? "Worker");
        const wage = toNum(row["monthly_wage"] ?? row["wage"] ?? row["salary"] ?? 0);
        const statsEligible = !toBool(row["no_pf"] ?? false);
        const otEligible = !toBool(row["no_ot"] ?? false);
        if (!code || !name) { skipped++; continue; }

        let deptId = deptMap.get(zone.toLowerCase());
        if (!deptId) {
          const [nd] = await db.insert(departmentsTable).values({ name: zone, displayOrder: deptMap.size + 1 }).returning();
          deptId = nd.id; deptMap.set(zone.toLowerCase(), deptId);
        }
        const existing = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.employeeCode, code));
        if (existing.length > 0) {
          await db.update(employeesTable).set({ name, departmentId: deptId, designation, monthlyWage: String(wage), statsEligible, otEligible }).where(eq(employeesTable.employeeCode, code));
          updated++;
        } else {
          await db.insert(employeesTable).values({ employeeCode: code, name, departmentId: deptId, designation, monthlyWage: String(wage), statsEligible, otEligible });
          inserted++;
        }
      } catch (err: any) { errors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`); }
    }
    return safeJson(res, { inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) { return safeJson(res, { error: err?.message ?? "Import failed" }, 400); }
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
        const sheets = parseWorkbook(req.file.buffer, req.file.mimetype);
        const attSheet = Object.keys(sheets).find((s) =>
          s.toLowerCase().includes("attend") || s.toLowerCase().includes("punch") || /^\d{2}$/.test(s)
        ) ?? Object.keys(sheets)[0];
        rows = rowsToObjects(sheets[attSheet]);
      }
    } else {
      rows = rowsToObjects(parseCsv(req.body.csv ?? ""));
    }

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
        let status = toStr(row["status"] ?? "present").toLowerCase();
        if (!VALID_STATUSES.has(status)) status = "present";
        const inTime1  = toTime(row["in_time1"]  ?? row["in1"]  ?? row["checkin"]  ?? row["punch_in"]  ?? row["intime1"]);
        const outTime1 = toTime(row["out_time1"] ?? row["out1"] ?? row["checkout"] ?? row["punch_out"] ?? row["outtime1"]);
        const inTime2  = toTime(row["in_time2"]  ?? row["in2"]  ?? row["intime2"]);
        const outTime2 = toTime(row["out_time2"] ?? row["out2"] ?? row["outtime2"]);
        const hoursWorked = row["hours_worked"] ?? row["hours"] ?? null;
        const note = toStr(row["note"] ?? row["notes"] ?? row["remark"] ?? "");
        const payload = {
          employeeId: empId, date, status,
          inTime1: inTime1 || null, outTime1: outTime1 || null,
          inTime2: inTime2 || null, outTime2: outTime2 || null,
          hoursWorked: hoursWorked != null ? String(toNum(hoursWorked)) : null,
          note: note || null,
        };
        const existing = await db.select({ employeeId: attendanceTable.employeeId }).from(attendanceTable)
          .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));
        if (existing.length > 0) {
          await db.update(attendanceTable).set(payload).where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));
          updated++;
        } else {
          await db.insert(attendanceTable).values(payload);
          inserted++;
        }
      } catch (err: any) { errors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`); }
    }
    return safeJson(res, { inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) { return safeJson(res, { error: err?.message ?? "Import failed" }, 400); }
});

// ─── /api/import/overtime ─────────────────────────────────────────────────

router.post("/import/overtime", upload.single("file"), async (req, res) => {
  try {
    const rows = getRows(req.file, req.body);
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
        await db.insert(overtimeTable).values({ employeeId: empId, date, hours: String(hours), reason: reason || null });
        inserted++;
      } catch (err: any) { errors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`); }
    }
    return safeJson(res, { inserted, skipped, errors, total: rows.length });
  } catch (err: any) { return safeJson(res, { error: err?.message ?? "Import failed" }, 400); }
});

// ─── /api/import/leaves ───────────────────────────────────────────────────

router.post("/import/leaves", upload.single("file"), async (req, res) => {
  try {
    const rows = getRows(req.file, req.body);
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
          status: ["pending", "approved", "rejected"].includes(status) ? status : "approved",
        });
        inserted++;
      } catch (err: any) { errors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`); }
    }
    return safeJson(res, { inserted, skipped, errors, total: rows.length });
  } catch (err: any) { return safeJson(res, { error: err?.message ?? "Import failed" }, 400); }
});

// ─── /api/import/payroll ──────────────────────────────────────────────────

router.post("/import/payroll", upload.single("file"), async (req, res) => {
  try {
    const rows = getRows(req.file, req.body);
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
        const existing = await db.select({ id: payrollLinesTable.id }).from(payrollLinesTable)
          .where(and(eq(payrollLinesTable.employeeId, empId), eq(payrollLinesTable.month, month)));
        if (existing.length > 0) {
          await db.update(payrollLinesTable).set(payload).where(and(eq(payrollLinesTable.employeeId, empId), eq(payrollLinesTable.month, month)));
          updated++;
        } else {
          await db.insert(payrollLinesTable).values(payload);
          inserted++;
        }
      } catch (err: any) { errors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`); }
    }
    return safeJson(res, { inserted, updated, skipped, errors, total: rows.length });
  } catch (err: any) { return safeJson(res, { error: err?.message ?? "Import failed" }, 400); }
});

// ─── /api/import/xlsx-bulk ────────────────────────────────────────────────
//
// ROOT CAUSE OF "Unexpected end of JSON input":
//
// 1. Missing `return` before early res.json() calls inside the handler meant
//    execution continued after sending the response. On large files this
//    caused a second (empty) write, corrupting the HTTP body.
//
// 2. The employee lookup for daily sheets was doubly-wrong:
//    - It called empMap.entries() → looked up by ID in the emps array →
//      compared the *code* to the row's "name" field. So it never matched.
//    - Newly inserted employees (from the Master sheet above) were not in the
//      map because the map was built before inserts.
//
// 3. The outer catch tried to call res.json() after the response had already
//    been closed by an earlier safeJson call, causing an unhandled exception
//    that left the socket dangling.
//
// All three are fixed below.
// ─────────────────────────────────────────────────────────────────────────

router.post("/import/xlsx-bulk", upload.single("file"), async (req, res) => {
  // ── Guard: file required ──────────────────────────────────────────────
  if (!req.file) return safeJson(res, { error: "No file uploaded" }, 400);

  // ── Parse workbook — surface parse errors immediately ─────────────────
  let sheets: Record<string, any[][]>;
  try {
    sheets = parseWorkbook(req.file.buffer, req.file.mimetype);
  } catch (parseErr: any) {
    return safeJson(res, { error: `Failed to parse file: ${parseErr?.message ?? "Unknown parse error"}` }, 400);
  }

  const summary: Record<string, any> = {};

  try {
    // ── Identify sheet roles ────────────────────────────────────────────
    const masterSheet = Object.keys(sheets).find(
      (s) => s.toLowerCase() === "master" || s.toLowerCase() === "mastersheet"
    );
    // Daily sheets: exactly two-digit names like "01", "02" … "28"
    const dailySheets = Object.keys(sheets).filter((s) => /^\d{2}$/.test(s.trim()));

    // Shared raw "CODE NAME" → empId map; populated during master import and/or daily re-fetch
    const byRawName = new Map<string, number>();

    // ── 1. Import employees from Master sheet ───────────────────────────
    if (masterSheet) {
      const rows = rowsToObjects(sheets[masterSheet]);
      const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode }).from(employeesTable);
      // Live map — updated as we insert so daily-sheet lookup works without a second DB fetch
      const empMap = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));
      const depts = await db.select().from(departmentsTable);
      const deptMap = new Map(depts.map((d) => [d.name.toLowerCase(), d.id]));
      let ins = 0, upd = 0, skip = 0;
      const masterErrors: string[] = [];

      for (const [i, row] of rows.entries()) {
        try {
          // Support two layouts:
          //   A) separate columns:  employee_code + name
          //   B) combined column:   "Z001 KAMTA PRASAD" in name_of_the_employee / name
          let code = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"] ?? "");
          let name = toStr(row["name_of_the_employee"] ?? row["name"] ?? row["employee_name"] ?? "");

          // Format B — code is empty but name looks like "Z001 KAMTA PRASAD"
          if (!code && name) {
            const m = name.match(/^([A-Za-z]\d{3})\s+(.+)$/);
            if (m) { code = m[1].toUpperCase(); name = m[2].trim(); }
          }
          // Format B variant — code column has the combined string
          if (code && !name) {
            const m = code.match(/^([A-Za-z]\d{3})\s+(.+)$/);
            if (m) { code = m[1].toUpperCase(); name = m[2].trim(); }
          }

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
            byRawName.set(`${code} ${name}`.toLowerCase(), empMap.get(code.toLowerCase())!);
            upd++;
          } else {
            const inserted = await db.insert(employeesTable)
              .values({ employeeCode: code, name, departmentId: deptId, designation: "Worker", monthlyWage: String(wage) })
              .returning({ id: employeesTable.id })
              .catch((e: any) => { masterErrors.push(`Row ${i + 2}: ${e?.message}`); return []; });
            if (inserted.length > 0) {
              empMap.set(code.toLowerCase(), inserted[0].id); // keep live for daily lookup
              byRawName.set(`${code} ${name}`.toLowerCase(), inserted[0].id);
              ins++;
            } else {
              skip++;
            }
          }
        } catch (err: any) {
          masterErrors.push(`Row ${i + 2}: ${err?.message ?? "Unknown"}`);
          skip++;
        }
      }
      summary["master_employees"] = { inserted: ins, updated: upd, skipped: skip, ...(masterErrors.length ? { errors: masterErrors.slice(0, 20) } : {}) };
    }

    // ── 2. Import attendance from daily sheets (01–28) ──────────────────
    if (dailySheets.length > 0) {
      const month = toStr(req.body.month ?? "");
      if (!month || !month.match(/^\d{4}-\d{2}$/)) {
        summary["daily_attendance"] = { error: "month param required (YYYY-MM) — set it before uploading" };
      } else {
        // Re-fetch after master insert so all employees are present
        const emps = await db.select({ id: employeesTable.id, code: employeesTable.employeeCode, name: employeesTable.name }).from(employeesTable);
        const byCode = new Map(emps.map((e) => [e.code.toLowerCase(), e.id]));
        const byName = new Map(emps.map((e) => [e.name.toLowerCase(), e.id]));
        // Also index by "CODE NAME" raw string (populated during master import above)
        // plus build it from DB in case no master sheet was processed this run
        emps.forEach((e) => byRawName.set(`${e.code} ${e.name}`.toLowerCase(), e.id));

        let ins = 0, upd = 0, skip = 0;
        const attendErrors: string[] = [];

        for (const sheetName of dailySheets) {
          const day = sheetName.trim().padStart(2, "0");
          const date = `${month}-${day}`;
          const rows = rowsToObjects(sheets[sheetName]);

          for (const [ri, row] of rows.entries()) {
            try {
              // Column layout in the actual xlsx daily sheets:
              //   name_of_the_employee | records | a_checkin_1 | b_checkout_1 | a_checkin_2 | b_checkout_2 | hours
              // The name column contains "Z001 KAMTA PRASAD" (same combined format as Master)
              const rawNameCol = toStr(
                row["name_of_the_employee"] ?? row["name"] ?? row["employee_name"] ?? row["employeename"] ?? ""
              );
              const codeRaw = toStr(row["employee_code"] ?? row["code"] ?? row["emp_code"] ?? row["employeecode"] ?? "");

              // Try to split "Z001 KAMTA PRASAD" from the name column if no explicit code
              let resolvedCode = codeRaw;
              let resolvedName = rawNameCol;
              if (!resolvedCode && rawNameCol) {
                const m = rawNameCol.match(/^([A-Za-z]\d{3})\s+(.+)$/);
                if (m) { resolvedCode = m[1].toUpperCase(); resolvedName = m[2].trim(); }
              }

              // Lookup: code → name → raw "CODE NAME" string → skip
              let empId = resolvedCode ? byCode.get(resolvedCode.toLowerCase()) : undefined;
              if (!empId && resolvedName) empId = byName.get(resolvedName.toLowerCase());
              if (!empId && rawNameCol) empId = byRawName.get(rawNameCol.toLowerCase());
              if (!empId) { skip++; continue; }

              const inTime1  = toTime(
                row["a_checkin_1"]  ?? row["checkin_1"]  ?? row["in_time1"]  ?? row["in1"]  ?? row["check_in"]  ?? row["intime1"]
              );
              const outTime1 = toTime(
                row["b_checkout_1"] ?? row["checkout_1"] ?? row["out_time1"] ?? row["out1"] ?? row["check_out"] ?? row["outtime1"]
              );
              const inTime2  = toTime(
                row["a_checkin_2"]  ?? row["checkin_2"]  ?? row["in_time2"]  ?? row["in2"]  ?? row["intime2"]
              );
              const outTime2 = toTime(
                row["b_checkout_2"] ?? row["checkout_2"] ?? row["out_time2"] ?? row["out2"] ?? row["outtime2"]
              );
              const hoursRaw = row["hours"] ?? row["hours_worked"] ?? row["total_hours"] ?? null;
              const hoursWorked = hoursRaw != null && toStr(hoursRaw) !== "" ? String(toNum(hoursRaw)) : null;

              const payload = {
                employeeId: empId, date,
                status: inTime1 ? "present" : "absent",
                inTime1: inTime1 || null, outTime1: outTime1 || null,
                inTime2: inTime2 || null, outTime2: outTime2 || null,
                hoursWorked, note: null,
              };

              const existing = await db.select({ employeeId: attendanceTable.employeeId }).from(attendanceTable)
                .where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));

              if (existing.length > 0) {
                await db.update(attendanceTable).set(payload).where(and(eq(attendanceTable.employeeId, empId), eq(attendanceTable.date, date)));
                upd++;
              } else {
                await db.insert(attendanceTable).values(payload as any);
                ins++;
              }
            } catch (err: any) {
              attendErrors.push(`Sheet ${sheetName} row ${ri + 2}: ${err?.message ?? "Unknown"}`);
              skip++;
            }
          }
        }
        summary["daily_attendance"] = {
          sheets: dailySheets.length, inserted: ins, updated: upd, skipped: skip,
          ...(attendErrors.length ? { errors: attendErrors.slice(0, 20) } : {}),
        };
      }
    }

    // ── Always send a complete JSON response ──────────────────────────
    return safeJson(res, { summary, sheetsFound: Object.keys(sheets) });

  } catch (err: any) {
    // Catch-all — always emit JSON so the client never gets an empty body
    return safeJson(res, {
      error: err?.message ?? "Import failed — unexpected server error",
      summary,
      sheetsFound: Object.keys(sheets),
    }, 500);
  }
});

// ─── DELETE routes ─────────────────────────────────────────────────────────

router.delete("/data/attendance", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) return safeJson(res, { error: "month param required (YYYY-MM)" }, 400);
    await db.delete(attendanceTable).where(and(gte(attendanceTable.date, `${month}-01`), lte(attendanceTable.date, `${month}-31`)));
    return safeJson(res, { deleted: true, month });
  } catch (err: any) { return safeJson(res, { error: err?.message }, 500); }
});

router.delete("/data/overtime", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) return safeJson(res, { error: "month param required (YYYY-MM)" }, 400);
    await db.delete(overtimeTable).where(and(gte(overtimeTable.date, `${month}-01`), lte(overtimeTable.date, `${month}-31`)));
    return safeJson(res, { deleted: true, month });
  } catch (err: any) { return safeJson(res, { error: err?.message }, 500); }
});

router.delete("/data/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return safeJson(res, { error: "Invalid employee id" }, 400);
    await db.delete(attendanceTable).where(eq(attendanceTable.employeeId, id));
    await db.delete(overtimeTable).where(eq(overtimeTable.employeeId, id));
    await db.delete(leavesTable).where(eq(leavesTable.employeeId, id));
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.employeeId, id));
    await db.delete(employeesTable).where(eq(employeesTable.id, id));
    return safeJson(res, { deleted: true, employeeId: id });
  } catch (err: any) { return safeJson(res, { error: err?.message }, 500); }
});

router.delete("/data/employees", async (req, res) => {
  try {
    const { confirm } = req.query as { confirm?: string };
    if (confirm !== "yes") return safeJson(res, { error: "Pass ?confirm=yes to delete all employees" }, 400);
    await db.delete(payrollLinesTable);
    await db.delete(leavesTable);
    await db.delete(overtimeTable);
    await db.delete(attendanceTable);
    await db.delete(employeesTable);
    return safeJson(res, { deleted: true, message: "All employees and related data deleted" });
  } catch (err: any) { return safeJson(res, { error: err?.message }, 500); }
});

router.delete("/data/payroll", async (req, res) => {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !month.match(/^\d{4}-\d{2}$/)) return safeJson(res, { error: "month param required (YYYY-MM)" }, 400);
    await db.delete(payrollLinesTable).where(eq(payrollLinesTable.month, month));
    return safeJson(res, { deleted: true, month });
  } catch (err: any) { return safeJson(res, { error: err?.message }, 500); }
});

export default router;
