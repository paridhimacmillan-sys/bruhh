'use client';
import React, { useState, useEffect } from 'react';
import { getDashboardData, subscribe } from '@/lib/store';
import { getTodayISOLocal } from '@/lib/date';
import { getDashboardShift, subscribeDashboardShift } from '@/lib/dashboardFilters';

export default function ItemProductionTable() {
  const [itemOutput, setItemOutput] = useState(() => getDashboardData(getTodayISOLocal(), getDashboardShift())?.itemOutput);

  useEffect(() => {
    const refresh = () => setItemOutput(getDashboardData(getTodayISOLocal(), getDashboardShift())?.itemOutput);
    const unsubStore = subscribe(refresh);
    const unsubShift = subscribeDashboardShift(refresh);
    return () => { unsubStore(); unsubShift(); };
  }, []);

  const activeItems = itemOutput?.filter((i) => i?.totalTarget > 0 || i?.totalActual > 0);

  return (
    <div className="card-base overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Item-wise Production</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Today&apos;s output per item</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actual</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eff%</th>
            </tr>
          </thead>
          <tbody>
            {activeItems?.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-xs text-muted-foreground">
                  No production data for today
                </td>
              </tr>
            ) : (
              activeItems?.map((item, idx) => {
                const eff = item?.totalTarget > 0
                  ? Math.round((item?.totalActual / item?.totalTarget) * 100)
                  : 0;
                return (
                  <tr
                    key={item?.itemId}
                    className={`border-b border-border hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-muted/10'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-foreground leading-tight truncate max-w-[160px]">
                        {item?.itemName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item?.machines?.length > 0 ? item?.machines?.join(', ') : 'No machine'}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-mono-nums text-xs font-semibold text-foreground">
                        {item?.totalActual > 0 ? item?.totalActual?.toLocaleString() : <span className="text-muted-foreground">—</span>}
                      </span>
                      <p className="font-mono-nums text-xs text-muted-foreground">
                        / {item?.totalTarget > 0 ? item?.totalTarget?.toLocaleString() : '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`font-mono-nums text-xs font-bold ${
                            eff >= 80
                              ? 'text-success'
                              : eff >= 50
                              ? 'text-warning'
                              : eff > 0
                              ? 'text-danger' :'text-muted-foreground'
                          }`}
                        >
                          {item?.totalTarget > 0 ? `${eff}%` : '—'}
                        </span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              eff >= 80
                                ? 'bg-success'
                                : eff >= 50
                                ? 'bg-warning'
                                : eff > 0
                                ? 'bg-danger' :'bg-muted-foreground'
                            }`}
                            style={{ width: `${Math.min(eff, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
