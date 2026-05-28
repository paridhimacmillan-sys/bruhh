'use client';

type Listener = () => void;

const KEY = 'machinetrack.shifts.v1';
const DEFAULT_SHIFTS = ['A', 'B', 'C'];
const listeners: Set<Listener> = new Set();

let shifts: string[] = [...DEFAULT_SHIFTS];

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeShiftName(name: string): string {
  return name.trim();
}

function persist() {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(KEY, JSON.stringify(shifts));
}

function notify() {
  listeners.forEach((l) => l());
}

export function bootstrapShifts() {
  if (!canUseLocalStorage()) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const clean = parsed
        .map((s) => normalizeShiftName(String(s)))
        .filter(Boolean);
      if (clean.length > 0) shifts = [...new Set(clean)];
    }
  } catch {
    // no-op
  }
}

export function getShifts(): string[] {
  return shifts.length > 0 ? shifts : [...DEFAULT_SHIFTS];
}

export function setShifts(next: string[]) {
  const clean = next.map(normalizeShiftName).filter(Boolean);
  shifts = clean.length > 0 ? [...new Set(clean)] : [...DEFAULT_SHIFTS];
  persist();
  notify();
}

export function addShift(name: string) {
  const n = normalizeShiftName(name);
  if (!n) return;
  if (shifts.some((s) => s.toLowerCase() === n.toLowerCase())) return;
  shifts = [...shifts, n];
  persist();
  notify();
}

export function removeShift(name: string) {
  const n = normalizeShiftName(name);
  const next = shifts.filter((s) => s.toLowerCase() !== n.toLowerCase());
  shifts = next.length > 0 ? next : [...DEFAULT_SHIFTS];
  persist();
  notify();
}

export function subscribeShifts(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
