'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Calendar, Download, RefreshCw, TrendingUp, TrendingDown,
  Activity, Layers, ChevronDown, FileBarChart2,
} from 'lucide-react';
import { getMachines, getItems, fetchEntriesForRange } from '@/lib/store';
import { ProductionEntry, Machine, Item } from '@/lib/mockData';

type RangePreset = '7d' | '14d' | '30d' | 'custom';
type GroupBy = 'date' | 'machine' | 'item' | 'shift';

function dateAdd(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = '2026-05-10';

function presetRange(p: RangePreset): { from: string; to: string } {
  if (p === '7d') return { from: dateAdd(TODAY, -6), to: TODAY };
  if (p === '14d') return { from: dateAdd(TODAY, -13), to: TODAY };
  if (p === '30d') return { from: dateAdd(TODAY, -29), to: TODAY };
  return { from: dateAdd(TODAY, -6), to: TODAY };
}

interface ReportRow {
  label: string;
  actual: number;
  target: number;
  efficiency: number;
  entries: number;
}

function buildReport(
  rangeEntries: ProductionEntry[],
  machines: Machine[],
  items: Item[],
  groupBy: GroupBy
): ReportRow[] {
  const groups: Record<string, { actual: number; target: number; count: number }> = {};

  rangeEntries.forEach((e) => {
    let key = '';
    if (groupBy === 'date') key = e.date;
    else if (groupBy === 'machine') key = machines.find((m) => m.id === e.machineId)?.machineNumber ?? e.machineId;
    else if (groupBy === 'item') key = items.find((i) => i.id === e.itemId)?.itemName ?? e.itemId;
    else if (groupBy === 'shift') key = `Shift ${e.shift}`;
    if (!groups[key]) groups[key] = { actual: 0, target: 0, count: 0 };
    groups[key].actual += e.totalActual;
    groups[key].target += e.totalExpected;
    groups[key].count += 1;
  });

  return Object.entries(groups)
    .map(([label, { actual, target, count }]) => ({
      label,
      actual,
      target,
      efficiency: target > 0 ? Math.round((actual / target) * 100) : 0,
      entries: count,
    }))
    .sort((a, b) => {
      if (groupBy === 'date') return a.label.localeCompare(b.label);
      return b.actual - a.actual;
    });
}

function downloadCSV(rows: ReportRow[], groupBy: GroupBy) {
  const header = ['Group', 'Actual (pcs)', 'Target (pcs)', 'Efficiency (%)', 'Entries'].join(',');
  const lines = rows.map((r) =>
    [`"${r.label}"`, r.actual, r.target, r.efficiency, r.entries].join(',')
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cnctrack-report-by-${groupBy}-${TODAY}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const COLORS = ['#1e40af', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function ReportsClient() {
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [dateFrom, setDateFrom] = useState(presetRange('7d').from);
  const [dateTo, setDateTo] = useState(presetRange('7d').to);
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [machines] = useState(getMachines());
  const [items] = useState(getItems());
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await fetchEntriesForRange(dateFrom, dateTo);
      setRows(buildReport(entries, machines, items, groupBy));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, groupBy, machines, items]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const handlePreset = (p: RangePreset) => {
    setPreset(p);
    if (p !== 'custom') {
      const { from, to } = presetRange(p);
      setDateFrom(from);
      setDateTo(to);
    }
  };

  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const overallEff = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  const bestRow = rows.reduce((best, r) => (r.efficiency > (best?.efficiency ?? -1) ? r : best), rows[0]);
  const worstRow = rows.filter((r) => r.target > 0).reduce(
    (worst, r) => (r.efficiency < (worst?.efficiency ?? 101) ? r : worst),
    rows.find((r) => r.target > 0)
  );

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <FileBarChart2 size={22} className="text-primary" />
            Production Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregate analysis across dates, machines, items and shifts
          </p>
        </div>
        <button
          onClick={() => downloadCSV(rows, groupBy)}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card-base p-4 flex flex-wrap items-end gap-4">
        {/* Preset buttons */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Range
          </p>
          <div className="flex gap-1">
            {(['7d', '14d', '30d', 'custom'] as RangePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border ${
                  preset === p
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {p === 'custom' ? 'Custom' : p === '7d' ? 'Last 7 days' : p === '14d' ? 'Last 14 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">From</p>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">To</p>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Group by */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Group by
          </p>
          <div className="relative">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-border rounded-md bg-card text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="date">Date</option>
              <option value="machine">Machine</option>
              <option value="item">Item / Part</option>
              <option value="shift">Shift</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Chart type */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
            Chart
          </p>
          <div className="flex gap-1">
            {(['bar', 'line'] as const).map((ct) => (
              <button
                key={ct}
                onClick={() => setChartType(ct)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border capitalize ${
                  chartType === ct
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {ct}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={loadReport}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors disabled:opacity-60 ml-auto"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Output', value: totalActual.toLocaleString(), unit: 'pcs',
            icon: Layers, iconBg: 'bg-primary/10', iconColor: 'text-primary',
          },
          {
            label: 'Total Target', value: totalTarget.toLocaleString(), unit: 'pcs',
            icon: Activity, iconBg: 'bg-muted', iconColor: 'text-muted-foreground',
          },
          {
            label: 'Overall Efficiency', value: overallEff.toString(), unit: '%',
            icon: overallEff >= 80 ? TrendingUp : TrendingDown,
            iconBg: overallEff >= 80 ? 'bg-success/10' : 'bg-danger/10',
            iconColor: overallEff >= 80 ? 'text-success' : 'text-danger',
          },
          {
            label: `Best ${groupBy === 'date' ? 'Day' : groupBy === 'machine' ? 'Machine' : groupBy === 'item' ? 'Item' : 'Shift'}`,
            value: bestRow?.efficiency?.toString() ?? '—', unit: bestRow ? '%' : '',
            sub: bestRow?.label ?? '—',
            icon: TrendingUp, iconBg: 'bg-success/10', iconColor: 'text-success',
          },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card-base card-hover p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</p>
                <span className={`p-1.5 rounded-md ${k.iconBg}`}>
                  <Icon size={14} className={k.iconColor} />
                </span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-metric-md">{k.value}</span>
                {k.unit && <span className="text-sm text-muted-foreground mb-0.5">{k.unit}</span>}
              </div>
              {'sub' in k && k.sub && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{k.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Output vs Target — by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateFrom} → {dateTo}
            </p>
          </div>
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="shimmer w-full h-full rounded-md" />
          </div>
        ) : rows.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            No data for selected range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'bar' ? (
              <BarChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
                  formatter={(v: number, name: string) => [v.toLocaleString(), name === 'actual' ? 'Actual' : 'Target']}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="target" fill="#e2e8f0" name="Target" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
                  {rows.map((r, i) => (
                    <Cell
                      key={i}
                      fill={r.efficiency >= 80 ? '#16a34a' : r.efficiency >= 60 ? '#d97706' : '#dc2626'}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={rows} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }}
                  formatter={(v: number, name: string) => [v.toLocaleString(), name === 'actual' ? 'Actual' : 'Target']}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 3" dot={false} name="Target" strokeWidth={2} />
                <Line type="monotone" dataKey="actual" stroke="#1e40af" dot={{ r: 4, fill: '#1e40af' }} name="Actual" strokeWidth={2} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Efficiency breakdown bar */}
      {rows.length > 0 && !loading && (
        <div className="card-base p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Efficiency Breakdown</h3>
          <div className="space-y-2">
            {rows.filter((r) => r.target > 0).map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 truncate shrink-0">{r.label}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(r.efficiency, 100)}%`,
                      backgroundColor: r.efficiency >= 80 ? 'var(--success)' : r.efficiency >= 60 ? 'var(--warning)' : 'var(--danger)',
                    }}
                  />
                </div>
                <span
                  className={`text-xs font-semibold font-mono-nums w-10 text-right shrink-0 ${
                    r.efficiency >= 80 ? 'text-success' : r.efficiency >= 60 ? 'text-warning' : 'text-danger'
                  }`}
                >
                  {r.efficiency}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data table */}
      <div className="card-base overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Detailed Data</h3>
          <span className="text-xs text-muted-foreground">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No data for selected range</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {groupBy === 'date' ? 'Date' : groupBy === 'machine' ? 'Machine' : groupBy === 'item' ? 'Item' : 'Shift'}
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actual</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gap</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Efficiency</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entries</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const gap = r.target - r.actual;
                  return (
                    <tr key={i} className={`border-b border-border hover:bg-muted/30 transition-colors ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                      <td className="px-5 py-3 font-medium text-foreground">{r.label}</td>
                      <td className="px-4 py-3 text-right font-mono-nums text-foreground">{r.actual.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono-nums text-muted-foreground">{r.target.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right font-mono-nums text-xs font-semibold ${gap > 0 ? 'text-danger' : 'text-success'}`}>
                        {gap > 0 ? `−${gap.toLocaleString()}` : `+${Math.abs(gap).toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono-nums ${
                          r.target === 0 ? 'text-muted-foreground' :
                          r.efficiency >= 80 ? 'bg-success/10 text-success' :
                          r.efficiency >= 60 ? 'bg-warning/10 text-warning' :
                          'bg-danger/10 text-danger'
                        }`}>
                          {r.target > 0 ? `${r.efficiency}%` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono-nums text-muted-foreground text-xs">{r.entries}</td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                  <td className="px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-3 text-right font-mono-nums">{totalActual.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono-nums text-muted-foreground">{totalTarget.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-mono-nums text-xs font-semibold ${totalTarget - totalActual > 0 ? 'text-danger' : 'text-success'}`}>
                    {totalTarget - totalActual > 0
                      ? `−${(totalTarget - totalActual).toLocaleString()}`
                      : `+${Math.abs(totalTarget - totalActual).toLocaleString()}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono-nums ${
                      overallEff >= 80 ? 'bg-success/10 text-success' :
                      overallEff >= 60 ? 'bg-warning/10 text-warning' :
                      'bg-danger/10 text-danger'
                    }`}>
                      {overallEff}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono-nums text-muted-foreground text-xs">
                    {rows.reduce((s, r) => s + r.entries, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Worst performer callout */}
      {worstRow && worstRow.efficiency < 70 && !loading && (
        <div className="warning-card p-4 flex items-start gap-3">
          <TrendingDown size={16} className="text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Lowest performer: {worstRow.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {worstRow.actual.toLocaleString()} of {worstRow.target.toLocaleString()} pcs ({worstRow.efficiency}% efficiency). Consider reviewing operator logs or scheduling maintenance.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
