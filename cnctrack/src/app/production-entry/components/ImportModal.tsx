'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import Modal from '@/components/ui/Modal';

export interface ImportRow {
  [key: string]: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  templateHeaders: string[];
  templateSampleRows: string[][];
  templateFileName: string;
  validateRow: (row: ImportRow, index: number) => ImportError[];
  onImport: (rows: ImportRow[]) => void;
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const cols: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  });
}

export default function ImportModal({
  open,
  onClose,
  title,
  templateHeaders,
  templateSampleRows,
  templateFileName,
  validateRow,
  onImport,
}: ImportModalProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setStep('upload');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) return;
      const headers = parsed[0].map((h) => h.toLowerCase().trim());
      const dataRows: ImportRow[] = parsed.slice(1).filter((r) => r.some((c) => c !== '')).map((r) => {
        const obj: ImportRow = {};
        headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        return obj;
      });
      const allErrors: ImportError[] = [];
      dataRows.forEach((row, i) => {
        allErrors.push(...validateRow(row, i));
      });
      setRows(dataRows);
      setErrors(allErrors);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const downloadTemplate = () => {
    const lines = [templateHeaders.join(','), ...templateSampleRows.map((r) => r.join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = rows.filter((_, i) => !errors.some((e) => e.row === i));
  const errorRowIndices = new Set(errors.map((e) => e.row));

  const handleImport = () => {
    onImport(validRows);
    handleClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={step === 'upload' ? 'Upload a CSV file to bulk import records' : `${rows.length} rows found · ${errors.length} errors · ${validRows.length} will be imported`}
      size="lg"
      footer={
        step === 'preview' ? (
          <>
            <button
              onClick={reset}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0}
              className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {validRows.length} Record{validRows.length !== 1 ? 's' : ''}
            </button>
          </>
        ) : undefined
      }
    >
      {step === 'upload' ? (
        <div className="space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border border-border">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Download Template</p>
                <p className="text-xs text-muted-foreground">Use this CSV template to format your data correctly</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-md hover:bg-muted transition-colors"
            >
              <Download size={13} />
              Template
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <Upload size={28} className={dragging ? 'text-primary' : 'text-muted-foreground'} />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
          </div>

          {/* Column guide */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Required Columns</p>
            <div className="flex flex-wrap gap-2">
              {templateHeaders.map((h) => (
                <span key={h} className="text-xs bg-muted px-2 py-1 rounded font-mono text-foreground">{h}</span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Error summary */}
          {errors.length > 0 && (
            <div className="p-3 bg-danger/5 border border-danger/20 rounded-md">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertCircle size={14} className="text-danger shrink-0" />
                <p className="text-xs font-semibold text-danger">{errors.length} validation error{errors.length > 1 ? 's' : ''} — affected rows will be skipped</p>
              </div>
              <ul className="space-y-0.5 max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <li key={i} className="text-xs text-danger/80">
                    Row {err.row + 2}: <span className="font-mono">{err.field}</span> — {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validRows.length > 0 && errors.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-success/5 border border-success/20 rounded-md">
              <CheckCircle2 size={14} className="text-success" />
              <p className="text-xs font-semibold text-success">All {rows.length} rows are valid and ready to import</p>
            </div>
          )}

          {/* Preview table */}
          <div className="border border-border rounded-md overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                    {templateHeaders.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground capitalize">{h}</th>
                    ))}
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const hasError = errorRowIndices.has(i);
                    return (
                      <tr key={i} className={`border-b border-border ${hasError ? 'bg-danger/5' : 'hover:bg-muted/20'}`}>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        {templateHeaders.map((h) => (
                          <td key={h} className="px-3 py-2 text-foreground font-mono max-w-[120px] truncate" title={row[h.toLowerCase()]}>
                            {row[h.toLowerCase()] || <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          {hasError ? (
                            <span className="flex items-center gap-1 text-danger text-xs"><X size={11} /> Error</span>
                          ) : (
                            <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 size={11} /> OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">File: <span className="font-mono">{fileName}</span></p>
        </div>
      )}
    </Modal>
  );
}
