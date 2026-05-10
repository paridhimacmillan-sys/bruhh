'use client';
import React, { useState } from 'react';
import { Copy, Calendar } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { getMachines, getItems, getEntries } from '@/lib/store';
import { GridRow } from './ProductionEntryClient';

type Shift = 'A' | 'B' | 'C';

interface Props {
  open: boolean;
  onClose: () => void;
  onCopy: (rows: GridRow[]) => void;
  currentDate: string;
  shift: Shift;
}

function getPreviousDate(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export default function CopyPreviousModal({ open, onClose, onCopy, currentDate, shift }: Props) {
  const prevDate = getPreviousDate(currentDate);
  const [selectedDate, setSelectedDate] = useState(prevDate);

  const machines = getMachines();
  const items = getItems();
  const entries = getEntries();

  const prevEntries = entries.filter(
    (e) => e.date === selectedDate && e.shift === shift
  );

  const previewRows: GridRow[] = prevEntries.map((entry) => ({
    machineId: entry.machineId,
    itemId: entry.itemId,
    entries: entry.entries,
    status: 'draft' as const,
    operatorName: entry.operatorName,
    notes: '',
  }));

  const handleCopy = () => {
    if (previewRows.length === 0) return;
    onCopy(previewRows);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Copy Previous Day Setup"
      subtitle="Machine and item assignments will be copied — actual values cleared"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={previewRows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50"
          >
            <Copy size={14} />
            Copy Setup ({previewRows.length} machines)
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Copy from date
          </label>
          <div className="relative inline-block">
            <input
              type="date"
              value={selectedDate}
              max={getPreviousDate(currentDate)}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-3 pr-9 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
            />
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Shift {shift} entries from {selectedDate} will be used as template
          </p>
        </div>

        {previewRows.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-md">
            <p className="text-sm text-muted-foreground">No Shift {shift} entries found for {selectedDate}</p>
            <p className="text-xs text-muted-foreground mt-1">Try selecting a different date</p>
          </div>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <div className="bg-muted/30 px-4 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Preview — {previewRows.length} machine setups found
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/10">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Machine</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Rate</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Operator</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const machine = machines.find((m) => m.id === row.machineId);
                  const item = items.find((i) => i.id === row.itemId);
                  const rate = row.entries[0]?.expected ?? 0;
                  return (
                    <tr key={`prev-row-${row.machineId}`} className={`border-b border-border ${idx % 2 === 0 ? '' : 'bg-muted/5'}`}>
                      <td className="px-4 py-2.5 font-mono-nums font-semibold text-xs text-foreground">
                        {machine?.machineNumber ?? row.machineId}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[160px]">
                        {item?.itemName ?? row.itemId}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono-nums text-xs text-foreground">
                        {rate} pcs/hr
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {row.operatorName || <span className="italic text-muted-foreground/50">Unassigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-info/5 border border-info/20 rounded-md px-4 py-3">
          <p className="text-xs text-info font-medium">
            Actual production values will be cleared. Only machine, item, expected rate, and operator assignments will be copied.
          </p>
        </div>
      </div>
    </Modal>
  );
}