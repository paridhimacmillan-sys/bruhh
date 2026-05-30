'use client';
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getDashboardData, subscribe } from '@/lib/store';
import { getTodayISOLocal } from '@/lib/date';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p: any) => p.dataKey === 'actual');
  const target = payload.find((p: any) => p.dataKey === 'target');
  const gap = (target?.value ?? 0) - (actual?.value ?? 0);
  return (
    <div className="card-base shadow-lg p-3 text-xs space-y-1.5 min-w-[140px]">
      <p className="font-semibold text-foreground">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Actual</span>
        <span className="font-mono-nums font-semibold text-primary">{actual?.value ?? 0} pcs</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Target</span>
        <span className="font-mono-nums font-semibold text-accent">{target?.value ?? 0} pcs</span>
      </div>
      <div className={`flex justify-between gap-4 pt-1 border-t border-border ${gap > 0 ? 'text-danger' : 'text-success'}`}>
        <span>Gap</span>
        <span className="font-mono-nums font-semibold">{gap > 0 ? `-${gap}` : `+${Math.abs(gap)}`} pcs</span>
      </div>
    </div>
  );
};

export default function HourlyTrendChart() {
  const [data, setData] = useState(() => getDashboardData(getTodayISOLocal(), 'A').hourlyTrend);

  useEffect(() => {
    const unsub = subscribe(() => {
      setData(getDashboardData(getTodayISOLocal(), 'A').hourlyTrend);
    });
    return unsub;
  }, []);

  const maxTarget = Math.max(...data.map((d) => d.target), 0);

  return (
    <div className="card-base p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hourly Production Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All active machines combined — Shift A</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-primary inline-block rounded" />
            <span className="text-muted-foreground">Actual</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-accent inline-block rounded" style={{ borderTop: '2px dashed var(--accent)' }} />
            <span className="text-muted-foreground">Target</span>
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.12} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="target"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#targetGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--primary)"
            strokeWidth={2}
            fill="url(#actualGrad)"
            dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'var(--primary)' }}
          />
          {maxTarget > 0 && (
            <ReferenceLine y={maxTarget} stroke="var(--accent)" strokeDasharray="3 3" strokeOpacity={0.4} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
