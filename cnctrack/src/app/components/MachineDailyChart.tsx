'use client';
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getDashboardData, subscribe } from '@/lib/store';
import { getTodayISOLocal } from '@/lib/date';
import { getDashboardShift, subscribeDashboardShift } from '@/lib/dashboardFilters';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p: any) => p.dataKey === 'actual')?.value ?? 0;
  const target = payload.find((p: any) => p.dataKey === 'target')?.value ?? 0;
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  return (
    <div className="card-base shadow-lg p-3 text-xs space-y-1.5 min-w-[140px]">
      <p className="font-semibold text-foreground">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-mono-nums font-semibold text-primary">{actual} pcs</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Target</span>
        <span className="font-mono-nums font-semibold text-muted-foreground">{target} pcs</span>
      </div>
      <div className={`flex justify-between gap-4 pt-1 border-t border-border font-semibold ${pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger'}`}>
        <span>Utilization</span>
        <span className="font-mono-nums">{pct}%</span>
      </div>
    </div>
  );
};

export default function MachineDailyChart() {
  const [data, setData] = useState(() => getDashboardData(getTodayISOLocal(), getDashboardShift()).machineOutput);

  useEffect(() => {
    const refresh = () => setData(getDashboardData(getTodayISOLocal(), getDashboardShift()).machineOutput);
    const unsubStore = subscribe(refresh);
    const unsubShift = subscribeDashboardShift(refresh);
    return () => { unsubStore(); unsubShift(); };
  }, []);

  return (
    <div className="card-base p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Daily Output per Machine</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Actual vs target — today</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="machine" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="target" fill="var(--muted)" radius={[3, 3, 0, 0]} barSize={14} />
          <Bar dataKey="actual" radius={[3, 3, 0, 0]} barSize={14}>
            {data.map((entry, index) => {
              const pct = entry.target > 0 ? (entry.actual / entry.target) * 100 : 0;
              const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : pct > 0 ? 'var(--warning)' : 'var(--danger)';
              return <Cell key={`cell-machine-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" /><span className="text-muted-foreground">≥80%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /><span className="text-muted-foreground">50–79%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning inline-block" /><span className="text-muted-foreground">&lt;50%</span></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-danger inline-block" /><span className="text-muted-foreground">Offline</span></span>
      </div>
    </div>
  );
}
