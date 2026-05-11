'use client';
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { getMachines, getItems } from '@/lib/store';
import { Machine, Item } from '@/lib/mockData';
import { GridRow } from './ProductionEntryClient';

type Shift = 'A' | 'B' | 'C';

interface Props {
  rows: GridRow[];
  shift: Shift;
  shiftHours: string[];
  onCellChange: (machineIdx: number, hourIdx: number, value: number) => void;
  onItemChange: (machineIdx: number, itemId: string) => void;
  onOperatorChange: (machineIdx: number, operatorName: string) => void;
  onNotesChange: (machineIdx: number, notes: string) => void;
}

export default function EntryGrid({ rows, shift, shiftHours, onCellChange, onItemChange, onOperatorChange, onNotesChange }: Props) {
  const [machines, setMachines] = useState<Machine[]>(() => getMachines());
  const [items, setItems] = useState<Item[]>(() => getItems());
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);

  useEffect(() => {
    setMachines(getMachines());
    setItems(getItems());
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="card-base p-12 text-center">
        <Clock size={32} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No active machines for this date and shift</p>
        <p className="text-xs text-muted-foreground mt-1">Add machines in Masters Management to begin logging</p>
      </div>
    );
  }

  return (
    <div className="card-base overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Hourly Production Grid — Shift {shift}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-success inline-block" />
            On target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-warning inline-block" />
            Slight gap
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-danger inline-block" />
            Below target
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-muted border border-border inline-block" />
            Not logged
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/20 min-w-[140px]">
                Machine
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[180px]">
                Item
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[130px]">
                Operator
              </th>
              {shiftHours.map((h, i) => (
                <th
                  key={`th-hour-${shift}-${i}`}
                  className="text-center px-1 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[72px]"
                >
                  <span className="font-mono-nums">{h}</span>
                </th>
              ))}
              <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px]">
                Total
              </th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px]">
                Target
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[80px]">
                Variance
              </th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[60px]">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, machineIdx) => {
              const machine = machines.find((m) => m.id === row.machineId);
              const item = items.find((i) => i.id === row.itemId);
              const totalActual = row.entries.reduce((s, e) => s + e.actual, 0);
              const totalExpected = row.entries.reduce((s, e) => s + e.expected, 0);
              const variance = totalActual - totalExpected;
              const loggedHours = row.entries.filter((e) => e.actual > 0).length;
              const rowEff = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;
              const isNotesExpanded = expandedNotes === machineIdx;

              return (
                <React.Fragment key={`grid-row-${row.machineId}`}>
                  <tr
                    className={`border-b border-border hover:bg-muted/20 transition-colors ${
                      machineIdx % 2 === 0 ? '' : 'bg-muted/5'
                    } ${row.status === 'flagged' ? 'bg-orange-50/40' : ''}`}
                  >
                    {/* Machine */}
                    <td className="px-4 py-3 sticky left-0 bg-card">
                      <div className="flex items-center gap-2">
                        {row.status === 'flagged' && (
                          <AlertTriangle size={12} className="text-warning shrink-0" />
                        )}
                        {row.status === 'submitted' && (
                          <CheckCircle2 size={12} className="text-success shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold font-mono-nums text-foreground text-xs">
                            {machine?.machineNumber ?? row.machineId}
                          </p>
                          <p className="text-xs text-muted-foreground">{machine?.machineType}</p>
                        </div>
                      </div>
                    </td>

                    {/* Item selector */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <select
                          value={row.itemId}
                          onChange={(e) => onItemChange(machineIdx, e.target.value)}
                          className="w-full appearance-none pl-2 pr-6 py-1.5 text-xs border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer truncate"
                        >
                          {items.filter((i) => i.status === 'active').map((i) => (
                            <option key={`item-opt-${row.machineId}-${i.id}`} value={i.id}>
                              {i.itemName.split(' — ')[0]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono-nums">
                        Target: {row.entries[0]?.expected ?? 0} pcs/hr
                      </p>
                    </td>

                    {/* Operator (editable) */}
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={row.operatorName}
                        onChange={(e) => onOperatorChange(machineIdx, e.target.value)}
                        placeholder="Operator name"
                        className="w-full px-2 py-1 text-xs border border-transparent hover:border-border focus:border-border rounded bg-transparent focus:bg-card focus:outline-none focus:ring-1 focus:ring-ring transition-colors truncate"
                      />
                    </td>

                    {/* Hourly cells */}
                    {row.entries.map((entry, hourIdx) => {
                      const pct = entry.expected > 0 ? (entry.actual / entry.expected) * 100 : 0;
                      const cellBg =
                        entry.actual === 0
                          ? ''
                          : pct >= 95
                          ? 'bg-success/10'
                          : pct >= 80
                          ? 'bg-warning/10' :'bg-danger/10';
                      return (
                        <td
                          key={`cell-${row.machineId}-h${hourIdx}`}
                          className={`px-1 py-2 text-center ${cellBg} transition-colors`}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <input
                              type="number"
                              value={entry.actual === 0 ? '' : entry.actual}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                onCellChange(machineIdx, hourIdx, isNaN(v) ? 0 : Math.max(0, v));
                              }}
                              className="grid-cell-input w-14"
                              min={0}
                              max={9999}
                              placeholder="—"
                            />
                            <span className="text-xs text-muted-foreground/60 font-mono-nums leading-none">
                              /{entry.expected}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Totals */}
                    <td className="px-3 py-3 text-right">
                      <span className="font-mono-nums font-bold text-foreground text-xs">
                        {totalActual > 0 ? totalActual.toLocaleString() : '—'}
                      </span>
                      <p className="text-xs text-muted-foreground font-mono-nums">{loggedHours}/8 hrs</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-mono-nums text-xs text-muted-foreground">
                        {totalExpected.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono-nums text-xs font-semibold ${
                          variance > 0
                            ? 'text-success'
                            : variance < 0
                            ? 'text-danger' :'text-muted-foreground'
                        }`}
                      >
                        {totalActual === 0
                          ? '—'
                          : variance >= 0
                          ? `+${variance}`
                          : variance}
                      </span>
                      {totalActual > 0 && (
                        <p className={`text-xs font-mono-nums ${
                          rowEff >= 95 ? 'text-success' : rowEff >= 80 ? 'text-warning' : 'text-danger'
                        }`}>
                          {Math.round(rowEff)}%
                        </p>
                      )}
                    </td>

                    {/* Notes toggle */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setExpandedNotes(isNotesExpanded ? null : machineIdx)}
                        className={`p-1.5 rounded-md transition-colors text-xs ${
                          row.notes
                            ? 'text-warning bg-warning/10 hover:bg-warning/20' :'text-muted-foreground hover:bg-muted'
                        }`}
                        title={row.notes ? 'View/edit note' : 'Add note'}
                      >
                        {row.notes ? <AlertTriangle size={12} /> : <span className="text-xs">+</span>}
                      </button>
                    </td>
                  </tr>

                  {/* Notes editor row */}
                  {isNotesExpanded && (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={14} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground shrink-0">
                            Note ({machine?.machineNumber}):
                          </span>
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => onNotesChange(machineIdx, e.target.value)}
                            placeholder="Add a note for this machine row..."
                            className="flex-1 px-2 py-1 text-xs border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                          <button
                            onClick={() => setExpandedNotes(null)}
                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                          >
                            Done
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {/* Footer totals */}
          <tfoot>
            <tr className="bg-muted/30 border-t-2 border-border">
              <td className="px-4 py-3 text-xs font-semibold text-foreground sticky left-0 bg-muted/30" colSpan={3}>
                Shift Total
              </td>
              {Array.from({ length: 8 }, (_, i) => {
                const colTotal = rows.reduce((sum, row) => sum + (row.entries[i]?.actual ?? 0), 0);
                const colExpected = rows.reduce((sum, row) => sum + (row.entries[i]?.expected ?? 0), 0);
                const colPct = colExpected > 0 ? Math.round((colTotal / colExpected) * 100) : 0;
                return (
                  <td key={`footer-col-${i}`} className="px-1 py-3 text-center">
                    <span className="font-mono-nums text-xs font-semibold text-foreground block">
                      {colTotal > 0 ? colTotal : '—'}
                    </span>
                    {colTotal > 0 && (
                      <span className={`font-mono-nums text-xs ${
                        colPct >= 95 ? 'text-success' : colPct >= 80 ? 'text-warning' : 'text-danger'
                      }`}>
                        {colPct}%
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-right">
                <span className="font-mono-nums font-bold text-foreground text-sm">
                  {rows.reduce((s, r) => s + r.entries.reduce((ss, e) => ss + e.actual, 0), 0).toLocaleString()}
                </span>
              </td>
              <td className="px-3 py-3 text-right">
                <span className="font-mono-nums text-xs text-muted-foreground">
                  {rows.reduce((s, r) => s + r.entries.reduce((ss, e) => ss + e.expected, 0), 0).toLocaleString()}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-mono-nums text-xs font-bold text-foreground">
                  {(() => {
                    const ta = rows.reduce((s, r) => s + r.entries.reduce((ss, e) => ss + e.actual, 0), 0);
                    const te = rows.reduce((s, r) => s + r.entries.reduce((ss, e) => ss + e.expected, 0), 0);
                    return te > 0 ? `${Math.round((ta / te) * 100)}%` : '—';
                  })()}
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}