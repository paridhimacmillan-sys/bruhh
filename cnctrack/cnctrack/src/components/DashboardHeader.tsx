'use client';
import React, { useState } from 'react';
import { RefreshCw, Calendar, ChevronDown } from 'lucide-react';
import { getTodayISOLocal } from '@/lib/date';

const SHIFTS = ['All Shifts', 'Shift A', 'Shift B', 'Shift C'];
const TODAY = getTodayISOLocal();
const DATES = [`${TODAY} (Today)`];

export default function DashboardHeader() {
  const [shift, setShift] = useState('Shift A');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Production Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Shop Floor A &mdash; Mixed Machine Operations &mdash;{' '}
          <span className="font-mono-nums text-xs">{TODAY}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Date selector */}
        <div className="relative">
          <select
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-md bg-card text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            defaultValue={`${TODAY} (Today)`}
          >
            {DATES?.map((d) => (
              <option key={`date-${d}`} value={d}>{d}</option>
            ))}
          </select>
          <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Shift selector */}
        <div className="relative">
          <select
            value={shift}
            onChange={(e) => setShift(e?.target?.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-md bg-card text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {SHIFTS?.map((s) => (
              <option key={`shift-${s}`} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-muted transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>

        {/* Last updated */}
        <span className="text-xs text-muted-foreground font-mono-nums">
          Updated 05:10 AM
        </span>
      </div>
    </div>
  );
}
