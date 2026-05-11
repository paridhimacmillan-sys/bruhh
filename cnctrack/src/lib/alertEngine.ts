'use client';
// Alert engine — evaluates configured thresholds against live dashboard data
// and inserts AlertEvents into Supabase (or in-memory) when thresholds are breached.

import { AlertThreshold, AlertEvent, dbInsertAlertEvent } from './supabase';

export type { AlertThreshold, AlertEvent };

// ─── In-memory alert events (shown in notification panel) ───────────────────
let inMemoryAlerts: AlertEvent[] = [];
let alertListeners: Set<() => void> = new Set();

export function subscribeAlerts(fn: () => void) {
  alertListeners.add(fn);
  return () => alertListeners.delete(fn);
}

function notifyAlerts() {
  alertListeners.forEach((l) => l());
}

export function getInMemoryAlerts(): AlertEvent[] {
  return inMemoryAlerts;
}

export function resolveInMemoryAlert(id: string) {
  inMemoryAlerts = inMemoryAlerts.map((a) => (a.id === id ? { ...a, resolved: true } : a));
  notifyAlerts();
}

export function clearResolvedAlerts() {
  inMemoryAlerts = inMemoryAlerts.filter((a) => !a.resolved);
  notifyAlerts();
}

// ─── Default thresholds (used when Supabase is not configured) ───────────────
export const DEFAULT_THRESHOLDS: AlertThreshold[] = [
  {
    id: 'thresh-eff',
    name: 'Low Efficiency',
    type: 'efficiency_below',
    threshold: 70,
    enabled: true,
    notify_in_app: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'thresh-gap',
    name: 'High Hourly Gap',
    type: 'hourly_gap_above',
    threshold: 15,
    enabled: true,
    notify_in_app: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'thresh-down',
    name: 'Machines Down',
    type: 'machine_down',
    threshold: 1,
    enabled: true,
    notify_in_app: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'thresh-flag',
    name: 'Flagged Entry',
    type: 'flagged_entry',
    threshold: 0,
    enabled: true,
    notify_in_app: true,
    created_at: new Date().toISOString(),
  },
];

// ─── Evaluate thresholds against dashboard snapshot ──────────────────────────
interface DashboardSnapshot {
  efficiency: number;
  avgHourlyGap: number;
  downMachines: Array<{ machineNumber: string; status: string }>;
  flaggedEntries: number;
}

// Track which alerts have already fired this session (avoid spam)
const firedThisSession = new Set<string>();

export async function evaluateAlerts(
  thresholds: AlertThreshold[],
  snap: DashboardSnapshot,
  persistToDb: boolean
) {
  for (const t of thresholds) {
    if (!t.enabled || !t.notify_in_app) continue;

    const candidates: Omit<AlertEvent, 'id' | 'created_at'>[] = [];

    if (t.type === 'efficiency_below' && snap.efficiency < t.threshold && snap.efficiency > 0) {
      const key = `${t.id}-eff-${Math.floor(snap.efficiency / 5)}`;
      if (!firedThisSession.has(key)) {
        firedThisSession.add(key);
        candidates.push({
          alert_id: t.id,
          type: 'efficiency_below',
          severity: snap.efficiency < 50 ? 'critical' : 'warning',
          title: 'Low Efficiency Alert',
          message: `Fleet efficiency is ${snap.efficiency}% — below the ${t.threshold}% threshold.`,
          machine_id: null,
          resolved: false,
        });
      }
    }

    if (t.type === 'hourly_gap_above' && snap.avgHourlyGap > t.threshold) {
      const key = `${t.id}-gap-${Math.floor(snap.avgHourlyGap / 5)}`;
      if (!firedThisSession.has(key)) {
        firedThisSession.add(key);
        candidates.push({
          alert_id: t.id,
          type: 'hourly_gap_above',
          severity: snap.avgHourlyGap > t.threshold * 2 ? 'critical' : 'warning',
          title: 'High Hourly Production Gap',
          message: `Average shortfall is ${snap.avgHourlyGap} pcs/hr — exceeds ${t.threshold} pcs/hr limit.`,
          machine_id: null,
          resolved: false,
        });
      }
    }

    if (t.type === 'machine_down' && snap.downMachines.length >= t.threshold) {
      snap.downMachines.forEach((m) => {
        const key = `${t.id}-down-${m.machineNumber}`;
        if (!firedThisSession.has(key)) {
          firedThisSession.add(key);
          candidates.push({
            alert_id: t.id,
            type: 'machine_down',
            severity: m.status === 'offline' ? 'critical' : 'warning',
            title: `${m.machineNumber} is ${m.status}`,
            message: `Machine ${m.machineNumber} status: ${m.status}. Production capacity reduced.`,
            machine_id: m.machineNumber,
            resolved: false,
          });
        }
      });
    }

    if (t.type === 'flagged_entry' && snap.flaggedEntries > 0) {
      const key = `${t.id}-flag-${snap.flaggedEntries}`;
      if (!firedThisSession.has(key)) {
        firedThisSession.add(key);
        candidates.push({
          alert_id: t.id,
          type: 'flagged_entry',
          severity: 'warning',
          title: 'Flagged Production Entries',
          message: `${snap.flaggedEntries} production entr${snap.flaggedEntries === 1 ? 'y' : 'ies'} flagged for review.`,
          machine_id: null,
          resolved: false,
        });
      }
    }

    for (const c of candidates) {
      const event: AlertEvent = {
        ...c,
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
      };
      inMemoryAlerts = [event, ...inMemoryAlerts].slice(0, 100);
      notifyAlerts();
      if (persistToDb) {
        await dbInsertAlertEvent(c).catch(console.error);
      }
    }
  }
}
