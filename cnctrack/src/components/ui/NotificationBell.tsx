'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import Link from 'next/link';
import { AlertEvent, getInMemoryAlerts, resolveInMemoryAlert, subscribeAlerts } from '@/lib/alertEngine';

function severityIcon(s: AlertEvent['severity']) {
  if (s === 'critical') return <XCircle size={13} className="text-danger shrink-0" />;
  if (s === 'warning') return <AlertTriangle size={13} className="text-warning shrink-0" />;
  return <Info size={13} className="text-info shrink-0" />;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAlerts(getInMemoryAlerts());
    return subscribeAlerts(() => setAlerts([...getInMemoryAlerts()]));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unresolved = alerts.filter((a) => !a.resolved);
  const recent = unresolved.slice(0, 5);

  const handleResolve = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    resolveInMemoryAlert(id);
    setAlerts([...getInMemoryAlerts()]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`sidebar-nav-item w-full relative ${collapsed ? 'justify-center px-2' : ''}`}
        title="Alerts"
      >
        <Bell size={18} className="shrink-0" />
        {!collapsed && <span className="flex-1 truncate">Alerts</span>}
        {unresolved.length > 0 && (
          <span
            className={`${collapsed ? 'absolute top-1 right-1 w-2 h-2 rounded-full bg-danger' : 'ml-auto bg-danger text-white text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center leading-none'}`}
          >
            {collapsed ? '' : unresolved.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 card-base shadow-xl z-50 overflow-hidden slide-up">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Alerts</p>
              <p className="text-xs text-muted-foreground">{unresolved.length} unresolved</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded transition-colors">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {recent.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <CheckCircle2 size={24} className="text-success mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No active alerts</p>
              </div>
            ) : (
              recent.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-start gap-2 hover:bg-muted/30 transition-colors group">
                  {severityIcon(a.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 font-mono-nums">{relativeTime(a.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => handleResolve(a.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-success/10 rounded transition-all"
                    title="Resolve"
                  >
                    <CheckCircle2 size={13} className="text-success" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-border">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="block w-full text-center text-xs font-semibold text-primary hover:underline"
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
