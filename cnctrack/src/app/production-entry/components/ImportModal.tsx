'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Eye, Download } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { getMachines, getItems } from '@/lib/store';
import { getShiftHours } from '@/lib/shifts';
import { GridRow } from './ProductionEntryClient';

type Shift = string;
type ImportStep = 'upload' | 'mapping' | 'preview' | 'validating';

interface ParsedRow {
  rawMachine: string;
  rawItem: string;
  rawHours: string[];
  rawOperator: string;
  resolvedMachineId: string | null;
  resolvedItemId: string | null;
  errors: string[];
  duplicate: boolean;
}

interface ColumnMapping {
  machineCol: string;
  itemCol: string;
  operatorCol: string;
  hourPrefix: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (rows: GridRow[]) => void;
  date: string;
  shift: Shift;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

async function parseFile(file: File): Promise<Record<string, string>[]> {
  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    return parseCSV(text);
  }
  // For xlsx files, use the xlsx library
  try {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return data.map((row) => {
      const normalized: Record<string, string> = {};
      Object.entries(row).forEach(([k, v]) => { normalized[String(k)] = String(v); });
      return normalized;
    });
  } catch {
    // Fallback: try as CSV
    const text = await file.text();
    return parseCSV(text);
  }
}

function validateRows(
  rawData: Record<string, string>[],
  mapping: ColumnMapping,
  existingMachineNumbers: Set<string>,
  hourCount: number
): ParsedRow[] {
  const machines = getMachines();
  const items = getItems();
  const seen = new Set<string>();

  return rawData.map((row) => {
    const rawMachine = (row[mapping.machineCol] ?? '').trim();
    const rawItem = (row[mapping.itemCol] ?? '').trim();
    const rawOperator = (row[mapping.operatorCol] ?? '').trim();

    // Detect one hour column for each configured hour in the selected shift.
    const rawHours: string[] = [];
    for (let i = 1; i <= hourCount; i++) {
      const key = `${mapping.hourPrefix}${i}`;
      const altKey = `H${i}`;
      rawHours.push(row[key] ?? row[altKey] ?? '0');
    }

    const errors: string[] = [];

    // Resolve machine
    const machine = machines.find(
      (m) => m.machineNumber.toLowerCase() === rawMachine.toLowerCase()
    );
    if (!rawMachine) {
      errors.push('Machine column is empty');
    } else if (!machine) {
      errors.push(`Machine "${rawMachine}" not found in master`);
    }

    // Resolve item
    const item = items.find(
      (i) => i.itemName.toLowerCase().includes(rawItem.toLowerCase()) ||
             rawItem.toLowerCase().includes(i.itemName.split(' â€” ')[0].toLowerCase())
    );
    if (!rawItem) {
      errors.push('Item column is empty');
    } else if (!item) {
      errors.push(`Item "${rawItem}" not found in master`);
    }

    // Validate hour values
    rawHours.forEach((h, idx) => {
      const v = parseInt(h, 10);
      if (h !== '' && h !== '0' && (isNaN(v) || v < 0)) {
        errors.push(`H${idx + 1} has invalid value: "${h}"`);
      }
    });

    // Duplicate detection
    const dupKey = `${rawMachine}-${rawItem}`;
    const duplicate = seen.has(dupKey) || existingMachineNumbers.has(rawMachine.toUpperCase());
    if (!duplicate) seen.add(dupKey);

    return {
      rawMachine,
      rawItem,
      rawHours,
      rawOperator,
      resolvedMachineId: machine?.id ?? null,
      resolvedItemId: item?.id ?? null,
      errors,
      duplicate,
    };
  });
}

export default function ImportModal({ open, onClose, onImport, date, shift }: Props) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({
    machineCol: 'Machine',
    itemCol: 'Item',
    operatorCol: 'Operator',
    hourPrefix: 'H',
  });
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    // Try to detect headers
    try {
      const data = await parseFile(f);
      if (data.length > 0) {
        setDetectedHeaders(Object.keys(data[0]));
      }
    } catch {
      setDetectedHeaders([]);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleParse = async () => {
    if (!file) return;
    setValidating(true);
    setStep('validating');
    try {
      const rawData = await parseFile(file);
      // Get existing machine numbers for duplicate detection
      const existingMachineNums = new Set<string>();
      const validated = validateRows(rawData, mapping, existingMachineNums, getShiftHours(shift).length);
      setParsed(validated);
    } catch (err) {
      setParsed([]);
    }
    setStep('preview');
    setValidating(false);
  };

  const validRows = parsed.filter((r) => r.errors.length === 0 && !r.duplicate);
  const errorRows = parsed.filter((r) => r.errors.length > 0);
  const dupRows = parsed.filter((r) => r.duplicate && r.errors.length === 0);

  const handleConfirmImport = () => {
    const machines = getMachines();
    const items = getItems();
    const gridRows: GridRow[] = validRows.map((r) => {
      const machine = machines.find((m) => m.id === r.resolvedMachineId);
      const item = items.find((candidate) => candidate.id === r.resolvedItemId);
      const rate = Number(item?.rates.find((override) => override.machineId === machine?.id)?.rate ?? item?.defaultRate ?? machine?.expectedPerHour ?? 60);
      return {
        machineId: r.resolvedMachineId!,
        itemId: r.resolvedItemId!,
        openingReading: 0,
        entries: r.rawHours.map((h, idx) => ({
          hour: idx + 1,
          actual: parseInt(h, 10) || 0,
          expected: rate,
          closingReading: null,
        })),
        status: 'draft' as const,
        operatorName: r.rawOperator,
        notes: '',
      };
    });
    onImport(gridRows);
    handleClose();
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setParsed([]);
    setDetectedHeaders([]);
    onClose();
  };

  const downloadTemplate = () => {
    const machines = getMachines();
    const items = getItems();
    const hourCount = getShiftHours(shift).length;
    const header = ['Machine', 'Item', 'Operator', ...Array.from({ length: hourCount }, (_, index) => `H${index + 1}`)].join(',');
    const example = machines.slice(0, 2).map((m) => {
      const item = items.find((i) => m.assignedItems?.includes(i.id)) ?? items[0];
      return [m.machineNumber, item?.itemName?.split(' - ')[0] ?? 'Item Name', '', ...Array.from({ length: hourCount }, () => '0')].join(',');
    });
    const csv = [header, ...example].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production_import_template_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Production Data"
      subtitle={
        step === 'upload' ?'Upload an Excel (.xlsx) or CSV file'
          : step === 'preview'
          ? `Preview â€” ${parsed.length} rows parsed`
          : 'Validating file...'
      }
      size="xl"
      footer={
        step === 'upload' ? (
          <>
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleParse}
              disabled={!file}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-95"
            >
              <Eye size={14} />
              Parse &amp; Preview
            </button>
          </>
        ) : step === 'preview' ? (
          <>
            <button onClick={() => { setStep('upload'); setParsed([]); }} className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors">
              Back
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={validRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-95"
            >
              <Upload size={14} />
              Import {validRows.length} Valid Row{validRows.length !== 1 ? 's' : ''}
            </button>
          </>
        ) : null
      }
    >
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              file ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet size={28} className="text-primary" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  {detectedHeaders.length > 0 && (
                    <p className="text-xs text-success mt-0.5">
                      {detectedHeaders.length} columns detected: {detectedHeaders.slice(0, 5).join(', ')}{detectedHeaders.length > 5 ? '...' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setDetectedHeaders([]); }}
                  className="ml-4 p-1 hover:bg-muted rounded"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload size={28} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv files</p>
              </>
            )}
          </div>

          {/* Field mapping */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Column Mapping</p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                <Download size={12} />
                Download Template
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Machine column header', key: 'machineCol' as const, placeholder: 'Machine' },
                { label: 'Item column header', key: 'itemCol' as const, placeholder: 'Item' },
                { label: 'Operator column header', key: 'operatorCol' as const, placeholder: 'Operator' },
                { label: 'Hour column prefix', key: 'hourPrefix' as const, placeholder: 'H (for H1, H2...)' },
              ].map((field) => (
                <div key={`map-${field.key}`}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{field.label}</label>
                  {detectedHeaders.length > 0 ? (
                    <select
                      value={mapping[field.key]}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                    >
                      <option value="">-- Select column --</option>
                      {detectedHeaders.map((h) => (
                        <option key={`hdr-${h}`} value={h}>{h}</option>
                      ))}
                      {/* Allow manual entry */}
                      <option value={mapping[field.key]}>{mapping[field.key]} (manual)</option>
                    </select>
                  ) : (
                    <input
                      value={mapping[field.key]}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Hour columns are auto-detected as H1â€“H8 or {mapping.hourPrefix}1â€“{mapping.hourPrefix}8. Machine numbers must match master exactly.
            </p>
          </div>

          {/* Expected format */}
          <div className="bg-muted/30 rounded-md p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Expected file format</p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    {['Machine', 'Item', 'Operator', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'].map((h) => (
                      <th key={`fmt-${h}`} className="border border-border px-2 py-1 bg-muted text-muted-foreground font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {['MCH-01', 'Spindle Shaft', 'Amit Sharma', '78', '82', '76', '80', '71', '0', '0', '0'].map((v, i) => (
                      <td key={`fmt-val-${i}`} className="border border-border px-2 py-1 font-mono-nums text-foreground">{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 'validating' && (
        <div className="py-16 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-foreground">Parsing and validating file...</p>
          <p className="text-xs text-muted-foreground">Matching machine numbers and item names against master data</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          {/* Validation summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="success-card p-3 rounded-md text-center">
              <p className="text-lg font-bold font-mono-nums text-success">{validRows.length}</p>
              <p className="text-xs text-success/80 font-medium">Valid rows</p>
            </div>
            <div className={`p-3 rounded-md text-center ${errorRows.length > 0 ? 'alert-card' : 'card-base'}`}>
              <p className={`text-lg font-bold font-mono-nums ${errorRows.length > 0 ? 'text-danger' : 'text-muted-foreground'}`}>
                {errorRows.length}
              </p>
              <p className={`text-xs font-medium ${errorRows.length > 0 ? 'text-danger/80' : 'text-muted-foreground'}`}>Errors</p>
            </div>
            <div className={`p-3 rounded-md text-center ${dupRows.length > 0 ? 'warning-card' : 'card-base'}`}>
              <p className={`text-lg font-bold font-mono-nums ${dupRows.length > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                {dupRows.length}
              </p>
              <p className={`text-xs font-medium ${dupRows.length > 0 ? 'text-warning/80' : 'text-muted-foreground'}`}>Duplicates</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="border border-border rounded-md overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                All {parsed.length} parsed rows
              </p>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90">
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Machine</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Item</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Operator</th>
                    {Array.from({ length: getShiftHours(shift).length }, (_, i) => (
                      <th key={`prev-h-${i}`} className="text-center px-2 py-2 font-semibold text-muted-foreground">H{i + 1}</th>
                    ))}
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, idx) => (
                    <tr
                      key={`preview-row-${idx}`}
                      className={`border-b border-border ${
                        row.errors.length > 0
                          ? 'bg-danger/5'
                          : row.duplicate
                          ? 'bg-warning/5' :''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono-nums font-semibold text-foreground">{row.rawMachine}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{row.rawItem}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[100px]">{row.rawOperator || 'â€”'}</td>
                      {row.rawHours.map((h, hi) => (
                        <td key={`ph-${idx}-${hi}`} className="px-2 py-2 text-center font-mono-nums text-foreground">
                          {h === '0' || h === '' ? <span className="text-muted-foreground/40">â€”</span> : h}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        {row.errors.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-danger font-semibold">
                            <AlertCircle size={11} />
                            Error
                          </span>
                        ) : row.duplicate ? (
                          <span className="inline-flex items-center gap-1 text-warning font-semibold">
                            <AlertCircle size={11} />
                            Duplicate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-success font-semibold">
                            <CheckCircle2 size={11} />
                            Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error details */}
          {errorRows.length > 0 && (
            <div className="alert-card p-3 rounded-md space-y-1.5">
              <p className="text-xs font-semibold text-danger flex items-center gap-1.5">
                <AlertCircle size={12} />
                {errorRows.length} row{errorRows.length > 1 ? 's' : ''} will be skipped due to errors:
              </p>
              {errorRows.map((row, idx) => (
                <div key={`err-detail-${idx}`} className="ml-4">
                  <p className="text-xs font-medium text-foreground">{row.rawMachine} / {row.rawItem}</p>
                  {row.errors.map((err, ei) => (
                    <p key={`err-msg-${idx}-${ei}`} className="text-xs text-danger/80 ml-2">â€¢ {err}</p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {dupRows.length > 0 && (
            <div className="warning-card p-3 rounded-md">
              <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                <AlertCircle size={12} />
                {dupRows.length} duplicate row{dupRows.length > 1 ? 's' : ''} detected and skipped â€” same machine/item combination appears more than once
              </p>
            </div>
          )}

          {parsed.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No rows could be parsed from the file.</p>
              <p className="text-xs mt-1">Check that the column mapping matches your file headers.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}


