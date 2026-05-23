'use client';
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { getMachines, getItems, getDashboardData, subscribe } from '@/lib/store';

export default function MachineStatusTable() {
  const [machines, setMachines] = useState(() => getMachines());
  const [items, setItems] = useState(() => getItems());
  const [machineOutput, setMachineOutput] = useState(() => getDashboardData('2026-05-10', 'A')?.machineOutput);

  useEffect(() => {
    const unsub = subscribe(() => {
      setMachines(getMachines());
      setItems(getItems());
      setMachineOutput(getDashboardData('2026-05-10', 'A')?.machineOutput);
    });
    return unsub;
  }, []);

  return (
    <div className="card-base overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Machine Status</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live floor status — {machines?.length} machines registered</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={12} />
          Live
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Machine</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Item</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actual</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Util%</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operator</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Entry</th>
            </tr>
          </thead>
          <tbody>
            {machines?.map((machine, idx) => {
              const dayData = machineOutput?.find((m) => m?.machine === machine?.machineNumber);
              const actual = dayData?.actual ?? 0;
              const target = dayData?.target ?? 0;
              const util = target > 0 ? Math.round((actual / target) * 100) : 0;
              const currentItem = machine?.currentItem
                ? items?.find((i) => i?.id === machine?.currentItem)?.itemName ?? '—' :'—';
              const isAtRisk = machine?.status === 'active' && util < 60 && target > 0;
              return (
                <tr
                  key={machine?.id}
                  className={`border-b border-border hover:bg-muted/30 transition-colors ${
                    idx % 2 === 0 ? '' : 'bg-muted/10'
                  } ${isAtRisk ? 'bg-orange-50/40' : ''}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {isAtRisk && <AlertTriangle size={12} className="text-warning shrink-0" />}
                      <span className="font-semibold text-foreground font-mono-nums">
                        {machine?.machineNumber}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">{machine?.machineType}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={machine?.status} />
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground max-w-[160px]">
                    <span className="truncate block">{currentItem}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono-nums font-semibold text-foreground text-xs">
                    {actual > 0 ? actual?.toLocaleString() : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-mono-nums text-muted-foreground text-xs">
                    {target > 0 ? target?.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span
                      className={`font-mono-nums text-xs font-semibold ${
                        util >= 80
                          ? 'text-success'
                          : util >= 50
                          ? 'text-warning'
                          : util > 0
                          ? 'text-danger' :'text-muted-foreground'
                      }`}
                    >
                      {target > 0 ? `${util}%` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {machine?.operatorName ?? <span className="italic">Unassigned</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-mono-nums text-xs text-muted-foreground">
                    {machine?.lastEntryTime ? `${machine?.lastEntryTime} AM` : <span className="text-danger font-medium">No entry</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}