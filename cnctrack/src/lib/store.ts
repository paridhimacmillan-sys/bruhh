'use client';

import {
  MACHINES as INITIAL_MACHINES,
  ITEMS as INITIAL_ITEMS,
  PRODUCTION_ENTRIES as INITIAL_ENTRIES,
  Machine,
  Item,
  ProductionEntry,
} from './mockData';

type Listener = () => void;
const listeners: Set<Listener> = new Set();
function notify() {
  listeners.forEach((l) => l());
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    bootstrapError = 'SESSION_INVALID';
    notify();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?error=SessionExpired';
    }
    throw new Error('SESSION_INVALID');
  }
  if (!res.ok) throw new Error(`API ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let machines: Machine[] = [...INITIAL_MACHINES];
let items: Item[] = [...INITIAL_ITEMS];
let entries: ProductionEntry[] = [...INITIAL_ENTRIES];
let dbReady = false;
let bootstrapPromise: Promise<void> | null = null;
let bootstrapError: string |
