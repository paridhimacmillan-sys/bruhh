'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, CheckCircle2, AlertTriangle, XCircle,
  Info, Settings2, Plus, Trash2, Save, RefreshCw, ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  AlertThreshold, AlertEvent,
  DEFAULT_THRESHOLDS,
  getInMemoryAlerts, resolveInMemoryAlert, clearResolvedAlerts,
  subscribeAlerts, evaluateAlerts,
} from '@/lib/alertEngine';
import {
  dbGetAlertThresholds, dbUpsertAlertThreshold, dbDeleteAlertThreshold,
  dbGetAlertEvents, dbResolveAlert,
} from '@/lib/supabase';
import { getDashboardData, getEntries, subscribe as subscribeStore } from '@/lib/store';

function isDbConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.startsWith('https://') && !url.includes('dummy');
}

const TYPE_LABELS: Record<AlertThreshold['type'], string> = {
  efficiency_below: 'Efficiency below %',
  hourly_gap_above: 'Hourly gap above pcs/hr',
  machine_down: 'Machines down ≥',
  flagged_entry: 'Flagged entries',
};

const TYPE_DESCRIPTIONS: Record<AlertThreshold['type'], string> = {
  efficiency_below: 'Fires when fleet efficiency drops below this %',
  hourly_gap_above: 'Fires when avg shortfall exceeds this pcs/hr',
  machine_down: 'Fires when this many machines are down simultaneously',
  flagged_entry: 'Fires whenever a production entry is flagged for review',
};

function severityIcon(s: AlertEvent['severity']) {
  if (s === 'critical') return <XCircle size={15} className="text-danger shrink-0" />;
  if (s === 'warning') return <AlertTriangle size={15} className="text-warning shrink-0" />;
  return <Info size={15} className="text-info shrink-0" />;
}

function severityBg(s: AlertEvent['severity']) {
  if (s === 'critical') return 'border-l-4 border-danger bg-danger/5';
  if (s === 'warning') return 'border-l-4 border-warning bg-warning/5';
  return 'border-l-4 border-info bg-info/5';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AlertsClient() {
  const [tab, setTab] = useState<'feed' | 'thresholds'>('feed');
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>(DEFAULT_THRESHOLDS);
  const [loadingThresholds, setLoadingThresholds] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const dbAvailable = isDbConfigured();

  // Load from DB or use defaults
  useEffect(() => {
    async function load() {
      setLoadingThresholds(true);
      try {
        if (dbAvailable) {
          const [dbT, dbE] = await Promise.all([
            dbGetAlertThresholds(),
            dbGetAlertEvents(100),
          ]);
          if (dbT.length > 0) setThresholds(dbT);
          setAlerts(dbE);
        } else {
          setAlerts(getInMemoryAlerts());
        }
      } catch {
        setAlerts(getInMemoryAlerts());
      } finally {
        setLoadingThresholds(false);
      }
    }
    load();
  }, [dbAvailable]);

  // Subscribe to in-memory alerts
  useEffect(() => { return subscribeAlerts(() => setAlerts([...getInMemoryAlerts()])); }, []);

  // Auto-evaluate alerts when store updates
  const runEvaluation = useCallback(() => {
    const snap = getDashboardData('2026-05-10', 'all');
    const flaggedEntries = getEntries().filter((e) => e.status === 'flagged').length;
    evaluateAlerts(
      thresholds,
      {
        efficiency: snap.efficiency,
        avgHourlyGap: snap.avgHourlyGap,
        downMachines: snap.downMachines.map((m) => ({ machineNumber: m.machineNumber, status: m.status })),
        flaggedEntries,
      },
      dbAvailable
    );
  }, [thresholds, dbAvailable]);

  useEffect(() => {
    runEvaluation();
    const unsub = subscribeStore(runEvaluation);
    return unsub;
  }, [runEvaluation]);

  const visibleAlerts = showResolved ? alerts : alerts.filter((a) => !a.resolved);
  const unresolvedCount = alerts.filter((a) => !a.resolved).length;

  const handleResolve = async (id: string) => {
    resolveInMemoryAlert(id);
    setAlerts([...getInMemoryAlerts()]);
    if (dbAvailable) await dbResolveAlert(id).catch(console.error);
  };

  const handleClearResolved = () => {
    clearResolvedAlerts();
    setAlerts([...getInMemoryAlerts()]);
  };

  // Threshold editing
  const [editDraft, setEditDraft] = useState<Partial<AlertThreshold>>({});

  const startEdit = (t: AlertThreshold) => {
    setEditingId(t.id);
    setEditDraft({ ...t });
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const saveThreshold = async (id: string) => {
    const updated = thresholds.map((t) => t.id === id ? { ...t, ...editDraft } : t);
    setThresholds(updated);
    setEditingId(null);
    if (dbAvailable) {
      setSavingId(id);
      try {
        const t = updated.find((x) => x.id === id)!;
        await dbUpsertAlertThreshold({ id: t.id, name: t.name, type: t.type, threshold: t.threshold, enabled: t.enabled, notify_in_app: t.notify_in_app });
      } catch { /* silently ignore */ }
      setSavingId(null);
    }
  };

  const toggleEnabled = async (id: string) => {
    const updated = thresholds.map((t) => t.id === id ? { ...t, enabled: !t.enabled } : t);
    setThresholds(updated);
    if (dbAvailable) {
      const t = updated.find((x) => x.id === id)!;
      await dbUpsertAlertThreshold({ id: t.id, name: t.name, type: t.type, threshold: t.threshold, enabled: t.enabled, notify_in_app: t.notify_in_app }).catch(console.error);
    }
  };

  const deleteThreshold = async (id: string) => {
    setThresholds((prev) => prev.filter((t) => t.id !== id));
    if (dbAvailable) await dbDeleteAlertThreshold(id).catch(console.error);
  };

  const addThreshold = () => {
    const newT: AlertThreshold = {
      id: `thresh-${Date.now()}`,
      name: 'New Alert',
      type: 'efficiency_below',
      threshold: 70,
      enabled: true,
      notify_in_app: true,
      created_at: new Date().toISOString(),
    };
    setThresholds((prev) => [...prev, newT]);
    startEdit(newT);
  };

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert size={22} className="text-primary" />
            Alerts & Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time threshold monitoring and alert history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unresolvedCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-danger/10 text-danger rounded-full border border-danger/20">
              <Zap size={12} />
              {unresolvedCount} active
            </span>
          )}
          {!dbAvailable && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Demo mode — connect Supabase to persist
            </span>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border gap-6">
        {[
          { key: 'feed', label: 'Alert Feed', icon: Bell },
          { key: 'thresholds', label: 'Thresholds', icon: Settings2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
            {key === 'feed' && unresolvedCount > 0 && (
              <span className="bg-danger text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none ml-0.5">
                {unresolvedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert Feed */}
      {tab === 'feed' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="rounded border-border"
                />
                Show resolved
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={runEvaluation}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
              >
                <RefreshCw size={12} />
                Re-evaluate
              </button>
              <button
                onClick={handleClearResolved}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                <Trash2 size={12} />
                Clear resolved
              </button>
            </div>
          </div>

          {/* Alert list */}
          {visibleAlerts.length === 0 ? (
            <div className="card-base p-12 text-center">
              <CheckCircle2 size={32} className="text-success mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">
                {showResolved ? 'No alerts recorded.' : 'No unresolved alerts. Click Re-evaluate to check thresholds.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleAlerts.map((a) => (
                <div
                  key={a.id}
                  className={`card-base rounded-md overflow-hidden transition-opacity ${a.resolved ? 'opacity-50' : ''} ${severityBg(a.severity)}`}
                >
                  <div className="px-4 py-3 flex items-start gap-3">
                    {severityIcon(a.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{a.title}</p>
                        <span className="text-xs text-muted-foreground shrink-0 font-mono-nums">
                          {relativeTime(a.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                      {a.machine_id && (
                        <span className="inline-block mt-1.5 px-2 py-0.5 bg-muted text-xs text-muted-foreground rounded font-mono-nums">
                          {a.machine_id}
                        </span>
                      )}
                    </div>
                    {!a.resolved && (
                      <button
                        onClick={() => handleResolve(a.id)}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <CheckCircle2 size={11} />
                        Resolve
                      </button>
                    )}
                    {a.resolved && (
                      <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-success bg-success/10 rounded-md">
                        <CheckCircle2 size={11} />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thresholds Config */}
      {tab === 'thresholds' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure which conditions trigger alerts. Changes take effect immediately.
            </p>
            <button
              onClick={addThreshold}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} />
              Add threshold
            </button>
          </div>

          {loadingThresholds ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-24 rounded-md" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {thresholds.map((t) => {
                const isEditing = editingId === t.id;
                const isSaving = savingId === t.id;
                const draft = isEditing ? { ...t, ...editDraft } : t;
                const needsThreshold = draft.type !== 'flagged_entry';

                return (
                  <div key={t.id} className={`card-base p-4 transition-all ${!t.enabled ? 'opacity-60' : ''}`}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">Alert name</label>
                            <input
                              type="text"
                              value={editDraft.name ?? ''}
                              onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1">Type</label>
                            <select
                              value={editDraft.type ?? t.type}
                              onChange={(e) => setEditDraft((p) => ({ ...p, type: e.target.value as AlertThreshold['type'] }))}
                              className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {Object.entries(TYPE_LABELS).map(([v, label]) => (
                                <option key={v} value={v}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[draft.type]}</p>
                        {needsThreshold && (
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-foreground">Threshold value</label>
                            <input
                              type="number"
                              min={0}
                              value={editDraft.threshold ?? t.threshold}
                              onChange={(e) => setEditDraft((p) => ({ ...p, threshold: Number(e.target.value) }))}
                              className="w-28 px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
                            />
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveThreshold(t.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                          >
                            {isSaving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                            Save
                          </button>
                          <button onClick={cancelEdit} className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-4">
                        {/* Toggle */}
                        <button
                          onClick={() => toggleEnabled(t.id)}
                          className={`mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors ${t.enabled ? 'bg-primary' : 'bg-muted-foreground/30'} relative`}
                          title={t.enabled ? 'Disable' : 'Enable'}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${t.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{t.name}</p>
                            <span className="px-2 py-0.5 bg-muted text-xs text-muted-foreground rounded font-mono-nums">
                              {TYPE_LABELS[t.type].replace('%', `${t.threshold}%`).replace('pcs/hr', `${t.threshold} pcs/hr`).replace('≥', `≥ ${t.threshold}`)}
                            </span>
                            {!t.enabled && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <BellOff size={11} /> Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{TYPE_DESCRIPTIONS[t.type]}</p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => startEdit(t)}
                            className="px-2.5 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteThreshold(t.id)}
                            className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                            title="Delete threshold"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
