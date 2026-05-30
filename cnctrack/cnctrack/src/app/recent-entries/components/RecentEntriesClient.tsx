'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Clock, Search, X, Calendar,
} from 'lucide-react';
import { getMachines, getItems, getEntries, subscribe } from '@/lib/store';
import { ProductionEntry, Machine, Item } from '@/lib/mockData';
import { getShifts, subscribeShifts } from '@/lib/shifts';

type Shift = string;

const PAGE_SIZE = 20;

const SHIFT_COLORS: Record<string, string> = {
  A: '#3b82f6',
  B: '#f97316',
  C: '#8b5cf6',
};

function effColor(eff: number) {
  if (eff >= 95) return 'text-success';
  if (eff >= 80) return 'text-warning';
  if (eff > 0) return 'text-danger';
  return 'text-muted-foreground';
}

function effBg(eff: number) {
  if (eff >= 95) return 'bg-success/10 text-success';
  if (eff >= 80) return 'bg-warning/10 text-warning';
  if (eff > 0) return 'bg-danger/10 text-danger';
  return 'bg-muted text-muted-foreground';
}

const SHIFT_HOURS: Record<Shift, string[]> = {
  A: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00'],
  B: ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
  C: ['22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'],
};

// ── Charts ────────────────────────────────────────────────────────────────
function SummaryCharts({ entries, machines }: { entries: ProductionEntry[]; machines: Machine[] }) {
  const machineData = useMemo(() => {
    const map: Record<string, { actual: number; target: number }> = {};
    entries.forEach((e) => {
      const name = machines.find((m) => m.id === e.machineId)?.machineNumber ?? e.machineId;
      if (!map[name]) map[name] = { actual: 0, target: 0 };
      map[name].actual += e.totalActual;
      map[name].target += e.totalExpected;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, actual: v.actual, target: v.target, eff: v.target > 0 ? Math.round((v.actual / v.target) * 100) : 0 }))
      .sort((a, b) => b.actual - a.actual);
  }, [entries, machines]);

  const dailyData = useMemo(() => {
    const map: Record<string, { actual: number; target: number }> = {};
    entries.forEach((e) => {
      if (!map[e.date]) map[e.date] = { actual: 0, target: 0 };
      map[e.date].actual += e.totalActual;
      map[e.date].target += e.totalExpected;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), actual: v.actual, target: v.target }));
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card-base p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Output by Machine</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={machineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)' }} />
            <Bar dataKey="actual" name="Actual" radius={[3, 3, 0, 0]}>
              {machineData.map((d, i) => (
                <Cell key={i} fill={d.eff >= 95 ? '#22c55e' : d.eff >= 80 ? '#f59e0b' : '#ef4444'} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar dataKey="target" name="Target" fill="var(--muted-foreground)" fillOpacity={0.2} radius={[3, 3, 0, 0]} />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card-base p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Daily Production Trend</p>
        {dailyData.length < 2 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-xs text-muted-foreground">Need data from at least 2 dates</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)' }} />
              <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Actual" />
              <Line type="monotone" dataKey="target" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target" />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Single entry row inside a date group ──────────────────────────────────
function EntryDetailRow({
  entry, machine, item, idx,
}: {
  entry: ProductionEntry;
  machine?: Machine;
  item?: Item;
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const eff = entry.totalExpected > 0 ? Math.round((entry.totalActual / entry.totalExpected) * 100) : 0;
  const loggedHours = entry.entries.filter((e) => e.actual > 0).length || 1;
  const avgPerHour = Math.round(entry.totalActual / loggedHours);
  const shiftHours = SHIFT_HOURS[entry.shift as Shift] ?? SHIFT_HOURS.A;

  return (
    <>
      {/* Main row */}
      <tr
        className={`border-b border-border hover:bg-muted/20 transition-colors cursor-pointer ${idx % 2 === 0 ? '' : 'bg-muted/5'}`}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Machine */}
        <td className="px-4 py-3">
          <p className="font-mono-nums font-semibold text-xs text-foreground">{machine?.machineNumber ?? entry.machineId}</p>
          <p className="text-xs text-muted-foreground">{machine?.machineType}</p>
        </td>

        {/* Item */}
        <td className="px-3 py-3 max-w-[160px]">
          <p className="text-xs text-foreground truncate">{item?.itemName ?? entry.itemId}</p>
          <p className="text-xs text-muted-foreground truncate">{entry.operatorName || 'Unassigned'}</p>
        </td>

        {/* Pieces */}
        <td className="px-3 py-3 text-right">
          <p className="font-mono-nums font-bold text-sm text-foreground">{entry.totalActual > 0 ? entry.totalActual.toLocaleString() : '—'}</p>
          <p className="text-xs text-muted-foreground font-mono-nums">/ {entry.totalExpected.toLocaleString()}</p>
        </td>

        {/* Shift */}
        <td className="px-3 py-3 text-center">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded font-mono"
            style={{ background: `${SHIFT_COLORS[entry.shift]}20`, color: SHIFT_COLORS[entry.shift] }}
          >
            {entry.shift}
          </span>
        </td>

        {/* Avg/hr */}
        <td className="px-3 py-3 text-right">
          <span className="font-mono-nums text-sm font-semibold text-foreground">
            {entry.totalActual > 0 ? avgPerHour : '—'}
          </span>
          {entry.totalActual > 0 && <span className="text-xs text-muted-foreground ml-1">pcs</span>}
        </td>

        {/* Target */}
        <td className="px-3 py-3 text-right">
          <span className="font-mono-nums text-xs text-muted-foreground">{entry.totalExpected.toLocaleString()}</span>
        </td>

        {/* Efficiency */}
        <td className="px-4 py-3 text-center">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-mono-nums ${effBg(eff)}`}>
            {entry.totalActual > 0 ? `${eff}%` : '—'}
          </span>
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-3 text-center">
          <span className="text-muted-foreground">
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </td>
      </tr>

      {/* Expanded hourly breakdown */}
      {open && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={8} className="px-4 py-4">
            <div className="space-y-3">
              {/* Stat pills */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div><span className="text-muted-foreground">Total Actual: </span><span className="font-mono-nums font-bold text-foreground">{entry.totalActual.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Total Target: </span><span className="font-mono-nums font-bold text-foreground">{entry.totalExpected.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Avg/hr: </span><span className="font-mono-nums font-bold text-foreground">{avgPerHour} pcs</span></div>
                <div><span className="text-muted-foreground">Hours Logged: </span><span className="font-mono-nums font-bold text-foreground">{loggedHours}/8</span></div>
              </div>

              {/* Hourly breakdown table */}
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 pr-4 text-muted-foreground font-semibold w-16">Hour</th>
                      {shiftHours.map((h) => (
                        <th key={h} className="text-center px-3 py-1.5 text-muted-foreground font-mono-nums font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 pr-4 text-muted-foreground font-semibold">Actual</td>
                      {entry.entries.map((e, i) => {
                        const pct = e.expected > 0 ? (e.actual / e.expected) * 100 : 0;
                        return (
                          <td key={i} className={`text-center px-3 py-1.5 font-mono-nums font-bold ${
                            e.actual === 0 ? 'text-muted-foreground/40' :
                            pct >= 95 ? 'text-success' : pct >= 80 ? 'text-warning' : 'text-danger'
                          }`}>
                            {e.actual || '—'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-4 text-muted-foreground font-semibold">Target</td>
                      {entry.entries.map((e, i) => (
                        <td key={i} className="text-center px-3 py-1.5 font-mono-nums text-muted-foreground">{e.expected}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mini chart */}
              <ResponsiveContainer width="100%" height={120}>
                <LineChart
                  data={entry.entries.map((e, i) => ({ hour: shiftHours[i] ?? `H${i + 1}`, actual: e.actual, target: e.expected }))}
                  margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)' }} />
                  <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="Actual" />
                  <Line type="monotone" dataKey="target" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Target" />
                </LineChart>
              </ResponsiveContainer>

              {entry.notes && (
                <p className="text-xs text-muted-foreground border-l-2 border-warning pl-3">
                  <span className="font-semibold text-foreground">Note:</span> {entry.notes}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Date group (collapsible section) ─────────────────────────────────────
function DateGroup({
  date, groupEntries, machines, items, defaultOpen,
}: {
  date: string;
  groupEntries: ProductionEntry[];
  machines: Machine[];
  items: Item[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const totalActual = groupEntries.reduce((s, e) => s + e.totalActual, 0);
  const totalExpected = groupEntries.reduce((s, e) => s + e.totalExpected, 0);
  const eff = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

  const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="card-base overflow-hidden">
      {/* Date header — click to collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border text-left group"
      >
        <Calendar size={14} className="text-muted-foreground shrink-0" />
        <span className="font-semibold text-sm text-foreground flex-1">{dayLabel}</span>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-muted-foreground font-mono-nums">{groupEntries.length} entr{groupEntries.length === 1 ? 'y' : 'ies'}</span>
          <span className="text-muted-foreground font-mono-nums">{totalActual.toLocaleString()} pcs</span>
          <span className={`font-bold font-mono-nums ${effColor(eff)}`}>{eff > 0 ? `${eff}%` : '—'}</span>
          {open ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Entries table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Machine</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item / Operator</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pieces</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shift</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg / hr</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eff.</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {groupEntries.map((entry, idx) => (
                <EntryDetailRow
                  key={entry.id}
                  entry={entry}
                  machine={machines.find((m) => m.id === entry.machineId)}
                  item={items.find((i) => i.id === entry.itemId)}
                  idx={idx}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function RecentEntriesClient() {
  const [entries, setEntries] = useState<ProductionEntry[]>(() => getEntries());
  const [machines, setMachines] = useState<Machine[]>(() => getMachines());
  const [items, setItems] = useState<Item[]>(() => getItems());

  const [search, setSearch] = useState('');
  const [shifts, setShifts] = useState<string[]>(() => getShifts());
  const [shiftFilter, setShiftFilter] = useState<'all' | Shift>('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const unsub = subscribe(() => {
      setEntries(getEntries());
      setMachines(getMachines());
      setItems(getItems());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeShifts(() => setShifts(getShifts()));
    return unsub;
  }, []);

  useEffect(() => { setPage(1); }, [search, shiftFilter, machineFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return [...entries]
      .filter((e) => e.status === 'submitted')
      .filter((e) => shiftFilter === 'all' || e.shift === shiftFilter)
      .filter((e) => machineFilter === 'all' || e.machineId === machineFilter)
      .filter((e) => !dateFrom || e.date >= dateFrom)
      .filter((e) => !dateTo || e.date <= dateTo)
      .filter((e) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const mNum = machines.find((m) => m.id === e.machineId)?.machineNumber?.toLowerCase() ?? '';
        const iName = items.find((i) => i.id === e.itemId)?.itemName?.toLowerCase() ?? '';
        const op = e.operatorName?.toLowerCase() ?? '';
        return mNum.includes(q) || iName.includes(q) || op.includes(q) || e.date.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.shift.localeCompare(b.shift));
  }, [entries, machines, items, search, shiftFilter, machineFilter, dateFrom, dateTo]);

  // Group by date, then paginate the GROUPS (not individual entries)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ProductionEntry[]>();
    filtered.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    });
    // Sort entries within each date by shift
    map.forEach((arr) => arr.sort((a, b) => a.shift.localeCompare(b.shift)));
    return [...map.entries()]; // [date, entries[]][]
  }, [filtered]);

  // Paginate by individual entry count across groups, keeping groups intact per page
  // Build pages: each page holds up to PAGE_SIZE entries, but never splits a date group
  const pages = useMemo(() => {
    const result: Array<typeof groupedByDate> = [];
    let current: typeof groupedByDate = [];
    let count = 0;
    for (const group of groupedByDate) {
      if (count > 0 && count + group[1].length > PAGE_SIZE) {
        result.push(current);
        current = [];
        count = 0;
      }
      current.push(group);
      count += group[1].length;
    }
    if (current.length > 0) result.push(current);
    return result;
  }, [groupedByDate]);

  const totalPages = Math.max(1, pages.length);
  const currentPageGroups = pages[page - 1] ?? [];

  const clearFilters = () => {
    setSearch(''); setShiftFilter('all'); setMachineFilter('all');
    setDateFrom(''); setDateTo('');
  };
  const hasFilters = !!(search || shiftFilter !== 'all' || machineFilter !== 'all' || dateFrom || dateTo);

  const totalActual = filtered.reduce((s, e) => s + e.totalActual, 0);
  const totalExpected = filtered.reduce((s, e) => s + e.totalExpected, 0);
  const overallEff = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recent Entries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All submitted production records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Records</p>
            <p className="font-mono-nums font-bold text-foreground">{filtered.length.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Total Pieces</p>
            <p className="font-mono-nums font-bold text-foreground">{totalActual.toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Overall Eff.</p>
            <p className={`font-mono-nums font-bold ${effColor(overallEff)}`}>{overallEff > 0 ? `${overallEff}%` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <SummaryCharts entries={filtered} machines={machines} />

      {/* Filters */}
      <div className="card-base p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search machine, item, operator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring w-full"
          />
        </div>
        <div className="flex gap-1">
          {(['all', ...shifts] as Array<'all' | string>).map((s) => (
            <button
              key={s}
              onClick={() => setShiftFilter(s)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                shiftFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-secondary'
              }`}
            >
              {s === 'all' ? 'All' : `Shift ${s}`}
            </button>
          ))}
        </div>
        <select
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Machines</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.machineNumber}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-xs border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums" />
          <span className="text-xs text-muted-foreground">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-xs border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors">
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Date groups */}
      {filtered.length === 0 ? (
        <div className="card-base px-5 py-16 text-center">
          <Clock size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No entries found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {hasFilters ? 'Try adjusting your filters' : 'Submit production entries to see them here'}
          </p>
          {hasFilters && <button onClick={clearFilters} className="mt-3 text-xs text-primary hover:underline">Clear filters</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {currentPageGroups.map(([date, groupEntries], i) => (
            <DateGroup
              key={date}
              date={date}
              groupEntries={groupEntries}
              machines={machines}
              items={items}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length.toLocaleString()} total records
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`min-w-[32px] h-8 px-2 text-xs font-semibold rounded-md border transition-colors ${
                      page === p ? 'bg-primary text-white border-primary' : 'border-border hover:bg-muted text-muted-foreground'
                    }`}>
                    {p}
                  </button>
                )
              )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

