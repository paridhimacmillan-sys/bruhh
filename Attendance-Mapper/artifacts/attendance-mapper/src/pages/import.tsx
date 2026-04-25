import { useState, useRef, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertTriangle, X, Download, Loader2, FileSpreadsheet, Users, CalendarCheck, Clock, Plane, IndianRupee, Info } from "lucide-react";
import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────

type ImportType = "employees" | "attendance" | "overtime" | "leaves" | "payroll" | "xlsx-bulk";

interface ImportResult {
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  total?: number;
  summary?: Record<string, any>;
  sheetsFound?: string[];
}

// ─── Config ────────────────────────────────────────────────────────────────

const IMPORT_TYPES: {
  id: ImportType;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  desc: string;
  requiredCols: string[];
  optionalCols: string[];
  templateRows: Record<string, string>[];
}[] = [
  {
    id: "xlsx-bulk",
    label: "Full Excel (.xlsm/.xlsx)",
    icon: FileSpreadsheet,
    color: "#16a34a",
    bg: "#f0fdf4",
    desc: "Import your existing attendance .xlsm file — auto-detects Master sheet for employees and daily sheets (01–28) for punch data.",
    requiredCols: ["Your original Excel file"],
    optionalCols: ["month param for daily sheets (YYYY-MM)"],
    templateRows: [],
  },
  {
    id: "employees",
    label: "Employee List",
    icon: Users,
    color: "#6366f1",
    bg: "#eef2ff",
    desc: "Import or update employees. Creates missing zones automatically.",
    requiredCols: ["employee_code", "name"],
    optionalCols: ["zone", "designation", "monthly_wage", "no_pf", "no_ot"],
    templateRows: [
      { employee_code: "Z001", name: "KAMTA PRASAD", zone: "Zone 1", designation: "Worker", monthly_wage: "9500", no_pf: "N", no_ot: "N" },
      { employee_code: "Z002", name: "DEEPAK BISHT", zone: "Zone 1", designation: "Worker", monthly_wage: "10000", no_pf: "N", no_ot: "N" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance / Punches",
    icon: CalendarCheck,
    color: "#0891b2",
    bg: "#ecfeff",
    desc: "Import daily punch records. Uses upsert — re-importing the same date updates existing records.",
    requiredCols: ["employee_code", "date"],
    optionalCols: ["status", "in_time1", "out_time1", "in_time2", "out_time2", "hours_worked", "note"],
    templateRows: [
      { employee_code: "Z001", date: "2025-02-01", status: "present", in_time1: "08:23", out_time1: "18:45", in_time2: "", out_time2: "", hours_worked: "10.37", note: "" },
      { employee_code: "Z002", date: "2025-02-01", status: "absent",  in_time1: "",      out_time1: "",      in_time2: "", out_time2: "", hours_worked: "",      note: "" },
    ],
  },
  {
    id: "overtime",
    label: "Overtime",
    icon: Clock,
    color: "#d97706",
    bg: "#fffbeb",
    desc: "Import overtime records by employee and date.",
    requiredCols: ["employee_code", "date", "hours"],
    optionalCols: ["reason"],
    templateRows: [
      { employee_code: "Z001", date: "2025-02-05", hours: "2.5", reason: "Rush order" },
      { employee_code: "Z003", date: "2025-02-05", hours: "3",   reason: "Maintenance" },
    ],
  },
  {
    id: "leaves",
    label: "Leaves",
    icon: Plane,
    color: "#7c3aed",
    bg: "#f5f3ff",
    desc: "Import leave requests. Status defaults to 'approved'.",
    requiredCols: ["employee_code", "start_date"],
    optionalCols: ["end_date", "leave_type", "reason", "status"],
    templateRows: [
      { employee_code: "Z001", start_date: "2025-02-10", end_date: "2025-02-11", leave_type: "casual", reason: "Personal", status: "approved" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll Deductions",
    icon: IndianRupee,
    color: "#dc2626",
    bg: "#fef2f2",
    desc: "Import advances, HRA, and electricity deductions per employee per month.",
    requiredCols: ["employee_code", "month"],
    optionalCols: ["opening_advance", "advance_bank", "advance_cash", "hra_elec", "closing_advance", "balance_cheque", "notes"],
    templateRows: [
      { employee_code: "Z001", month: "2025-02", opening_advance: "5000", advance_bank: "2000", advance_cash: "1000", hra_elec: "500", closing_advance: "2000", balance_cheque: "0", notes: "" },
    ],
  },
];

// ─── Template download ──────────────────────────────────────────────────────

function downloadTemplate(type: (typeof IMPORT_TYPES)[0]) {
  if (!type.templateRows.length) return;
  const ws = XLSX.utils.json_to_sheet(type.templateRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `template_${type.id}.xlsx`);
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [selectedType, setSelectedType] = useState<ImportType>("xlsx-bulk");
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[]; total: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cfg = IMPORT_TYPES.find((t) => t.id === selectedType)!;

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(null);
    if (selectedType === "xlsx-bulk") return; // no preview for bulk

    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("type", selectedType);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview({ columns: data.columns, rows: data.preview, total: data.total });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewing(false);
    }
  }, [selectedType]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (month) fd.append("month", month);
      const res = await fetch(`/api/import/${selectedType}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: 900 }}>
      <style>{`
        .type-card { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; cursor: pointer; transition: all 0.12s; display: flex; align-items: center; gap: 12px; background: white; }
        .type-card:hover { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }
        .type-card.active { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); background: #fafafa; }
        .drop-zone { border: 2px dashed #d1d5db; border-radius: 12px; padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.15s; background: #fafafa; }
        .drop-zone:hover, .drop-zone.active { border-color: #6366f1; background: #eef2ff; }
        .pill { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 20px; font-weight: 500; font-family: 'JetBrains Mono', monospace; }
        .pill-required { background: #fee2e2; color: #991b1b; }
        .pill-optional { background: #f1f5f9; color: #475569; }
        .result-stat { background: white; border-radius: 10px; padding: 16px; border: 1px solid #e5e7eb; text-align: center; }
        .btn-primary { background: #6366f1; color: white; border: none; border-radius: 8px; padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.12s; }
        .btn-primary:hover { background: #4f46e5; }
        .btn-primary:disabled { background: #a5b4fc; cursor: not-allowed; }
        .btn-ghost { background: white; color: #374151; border: 1.5px solid #e5e7eb; border-radius: 8px; padding: 9px 18px; font-size: 13.5px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.12s; }
        .btn-ghost:hover { border-color: #6366f1; color: #6366f1; }
        .error-row { font-size: 11.5px; font-family: monospace; padding: 5px 10px; background: #fef2f2; border-radius: 5px; color: #991b1b; word-break: break-all; }
        .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; color: #9ca3af; text-transform: uppercase; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        th { text-align: left; padding: 8px 12px; background: #f8fafc; color: #6b7280; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
        td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fafafa; }
      `}</style>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Import Data</div>
        <div style={{ fontSize: 13.5, color: "#9ca3af", marginTop: 3 }}>
          Upload CSV or Excel files to bulk-import employees, attendance, payroll and more.
        </div>
      </div>

      {/* Type selector */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-label">What are you importing?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {IMPORT_TYPES.map((t) => (
            <div
              key={t.id}
              className={`type-card ${selectedType === t.id ? "active" : ""}`}
              onClick={() => { setSelectedType(t.id); reset(); }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <t.icon size={17} color={t.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{t.label}</div>
              </div>
              {selectedType === t.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* Left: upload + preview + result */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Description */}
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid #e5e7eb" }}>
            <Info size={15} color="#6366f1" style={{ marginTop: 1, flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{cfg.desc}</div>
          </div>

          {/* Month picker for xlsx-bulk and attendance */}
          {(selectedType === "xlsx-bulk" || selectedType === "attendance") && (
            <div>
              <div className="section-label">{selectedType === "xlsx-bulk" ? "Month (for daily sheets)" : "Month"}</div>
              <input
                type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                style={{ padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#374151", width: 180 }}
                placeholder="YYYY-MM"
              />
              {selectedType === "xlsx-bulk" && (
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5 }}>Required to map daily sheets (01–28) to correct dates.</div>
              )}
            </div>
          )}

          {/* Drop zone */}
          {!file ? (
            <div
              className={`drop-zone ${dragging ? "active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef} type="file" style={{ display: "none" }}
                accept=".csv,.xlsx,.xlsm,.xls"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Upload size={28} color="#9ca3af" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Drop your file here</div>
              <div style={{ fontSize: 13, color: "#9ca3af" }}>or click to browse — .csv, .xlsx, .xlsm supported</div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[".csv", ".xlsx", ".xlsm"].map((ext) => (
                  <span key={ext} style={{ padding: "3px 10px", borderRadius: 20, background: "#f1f5f9", fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>{ext}</span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ border: "1.5px solid #d1fae5", borderRadius: 10, padding: "14px 16px", background: "#f0fdf4", display: "flex", alignItems: "center", gap: 12 }}>
              <FileText size={20} color="#16a34a" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#14532d" }}>{file.name}</div>
                <div style={{ fontSize: 12, color: "#16a34a" }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6b7280" }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* Preview table */}
          {previewing && (
            <div style={{ padding: 24, textAlign: "center", background: "white", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <Loader2 size={20} color="#6366f1" style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 13, color: "#9ca3af" }}>Previewing file…</div>
            </div>
          )}

          {preview && !result && (
            <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Preview</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{preview.total} rows detected — showing first 5</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>{preview.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i}>{preview.columns.map((c) => <td key={c}>{String(row[c] ?? "")}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: "#991b1b" }}>{error}</div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ background: "white", borderRadius: 12, border: "1.5px solid #d1fae5", overflow: "hidden" }}>
              <div style={{ background: "#f0fdf4", padding: "14px 18px", borderBottom: "1px solid #d1fae5", display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={18} color="#16a34a" />
                <div style={{ fontWeight: 600, fontSize: 14, color: "#14532d" }}>Import complete!</div>
              </div>

              {/* For bulk import */}
              {result.summary ? (
                <div style={{ padding: 18 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#374151", marginBottom: 12 }}>
                    Sheets found: {result.sheetsFound?.join(", ")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.entries(result.summary).map(([key, val]: [string, any]) => (
                      <div key={key} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{key.replace(/_/g, " ")}</div>
                        {val.error ? (
                          <div style={{ fontSize: 12.5, color: "#dc2626" }}>{val.error}</div>
                        ) : (
                          <div style={{ display: "flex", gap: 16, fontSize: 13, flexWrap: "wrap" }}>
                            {Object.entries(val).map(([k, v]) => (
                              <span key={k} style={{ color: "#374151" }}><strong>{String(v)}</strong> {k}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: 18 }}>
                    {[
                      { label: "Total rows",  value: result.total    ?? 0, color: "#374151" },
                      { label: "Inserted",    value: result.inserted ?? 0, color: "#16a34a" },
                      { label: "Updated",     value: result.updated  ?? 0, color: "#2563eb" },
                      { label: "Skipped",     value: result.skipped  ?? 0, color: "#9ca3af" },
                    ].map((s) => (
                      <div key={s.label} className="result-stat">
                        <div style={{ fontSize: 26, fontWeight: 700, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div style={{ padding: "0 18px 18px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>
                        {result.errors.length} rows had errors:
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                        {result.errors.map((e, i) => (
                          <div key={i} className="error-row">{e}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div style={{ padding: "12px 18px", borderTop: "1px solid #d1fae5", display: "flex", gap: 8 }}>
                <button className="btn-ghost" onClick={reset} style={{ fontSize: 13 }}>Import another file</button>
              </div>
            </div>
          )}

          {/* Action button */}
          {file && !result && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={importing}
              >
                {importing
                  ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Importing…</>
                  : <><Upload size={15} /> Import {preview ? `${preview.total} rows` : "file"}</>
                }
              </button>
              <button className="btn-ghost" onClick={reset}>Cancel</button>
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Column guide */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Column guide</div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {cfg.requiredCols.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5 }}>REQUIRED</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {cfg.requiredCols.map((c) => <span key={c} className="pill pill-required">{c}</span>)}
                  </div>
                </div>
              )}
              {cfg.optionalCols.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5 }}>OPTIONAL</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {cfg.optionalCols.map((c) => <span key={c} className="pill pill-optional">{c}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Download template */}
          {cfg.templateRows.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => downloadTemplate(cfg)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Download size={14} />
              Download template
            </button>
          )}

          {/* Tips */}
          <div style={{ background: "#fffbeb", borderRadius: 10, padding: "14px 16px", border: "1px solid #fde68a" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>Tips</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>
              <div>• Column headers are flexible — <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 3 }}>emp_code</code>, <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 3 }}>code</code>, <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 3 }}>employee_code</code> all work.</div>
              <div>• Dates: <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 3 }}>YYYY-MM-DD</code> or <code style={{ background: "#fef3c7", padding: "0 3px", borderRadius: 3 }}>DD/MM/YYYY</code>.</div>
              <div>• Importing attendance uses upsert — same employee + date overwrites existing.</div>
              {selectedType === "xlsx-bulk" && <div>• Set the month before uploading so daily sheets 01–28 map to the right dates.</div>}
            </div>
          </div>

          {/* Supported formats */}
          <div style={{ background: "white", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Supported formats</div>
            {[
              { ext: ".csv", note: "Comma-separated, UTF-8" },
              { ext: ".xlsx", note: "Excel 2007+" },
              { ext: ".xlsm", note: "Excel with macros (your attendance sheet)" },
            ].map((f) => (
              <div key={f.ext} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#475569", flexShrink: 0 }}>{f.ext}</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{f.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Delete Data Section ─────────────────────────────────────────── */}
      <DeleteSection />
    </div>
  );
}

// ─── Delete Section ────────────────────────────────────────────────────────

function DeleteSection() {
  const [month, setMonth] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);

  const doDelete = async (type: string, params: Record<string, string> = {}) => {
    setLoading(type);
    setResult(null);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/data/${type}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setResult({ type: "success", message: `Deleted successfully${params.month ? ` for ${params.month}` : ""}.` });
    } catch (e: any) {
      setResult({ type: "error", message: e.message });
    } finally {
      setLoading(null);
      setConfirming(null);
    }
  };

  const actions = [
    {
      id: "attendance",
      label: "Delete attendance records",
      desc: "Remove all punch data for a specific month",
      color: "#d97706",
      needsMonth: true,
      confirm: `Delete all attendance for ${month || "selected month"}?`,
      onConfirm: () => doDelete("attendance", { month }),
    },
    {
      id: "overtime",
      label: "Delete overtime records",
      desc: "Remove all OT entries for a specific month",
      color: "#d97706",
      needsMonth: true,
      confirm: `Delete all overtime for ${month || "selected month"}?`,
      onConfirm: () => doDelete("overtime", { month }),
    },
    {
      id: "payroll",
      label: "Delete payroll deductions",
      desc: "Remove advances/HRA entries for a specific month",
      color: "#d97706",
      needsMonth: true,
      confirm: `Delete all payroll lines for ${month || "selected month"}?`,
      onConfirm: () => doDelete("payroll", { month }),
    },
    {
      id: "employees",
      label: "Delete ALL employees",
      desc: "Permanently removes all employees and their attendance, OT, leaves, payroll",
      color: "#dc2626",
      needsMonth: false,
      confirm: "This will permanently delete ALL employees and ALL their data. This cannot be undone.",
      onConfirm: () => doDelete("employees", { confirm: "yes" }),
    },
  ];

  return (
    <div style={{ marginTop: 40, borderTop: "1px solid #e5e7eb", paddingTop: 32 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>Delete Data</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 3 }}>Permanently remove records. This cannot be undone.</div>
      </div>

      {/* Month picker for month-scoped deletes */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>Month (for attendance / overtime / payroll deletes)</label>
        <input
          type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ padding: "8px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#374151", width: 180 }}
        />
      </div>

      {result && (
        <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 8, background: result.type === "success" ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.type === "success" ? "#bbf7d0" : "#fca5a5"}`, fontSize: 13, color: result.type === "success" ? "#15803d" : "#dc2626", display: "flex", alignItems: "center", gap: 8 }}>
          {result.type === "success" ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          {result.message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {actions.map((a) => (
          <div key={a.id} style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 3 }}>{a.label}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12, lineHeight: 1.5 }}>{a.desc}</div>

            {confirming === a.id ? (
              <div>
                <div style={{ fontSize: 12, color: a.color, fontWeight: 500, marginBottom: 10, lineHeight: 1.5, background: a.color === "#dc2626" ? "#fef2f2" : "#fffbeb", padding: "8px 10px", borderRadius: 6 }}>
                  ⚠ {a.confirm}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={a.onConfirm}
                    disabled={!!loading || (a.needsMonth && !month)}
                    style={{ flex: 1, background: a.color, color: "white", border: "none", borderRadius: 6, padding: "7px 0", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: (a.needsMonth && !month) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  >
                    {loading === a.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : null}
                    {loading === a.id ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    style={{ padding: "7px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#6b7280" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(a.id)}
                style={{ width: "100%", padding: "7px 0", background: "white", border: `1.5px solid ${a.color}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: a.color, cursor: "pointer", transition: "all 0.12s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = a.color; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "white"; (e.currentTarget as HTMLButtonElement).style.color = a.color; }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
