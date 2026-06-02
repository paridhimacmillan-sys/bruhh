'use client';

type Listener = () => void;
const listeners = new Set<Listener>();
let selectedShift = 'all';

export function getDashboardShift() {
  return selectedShift;
}

export function setDashboardShift(shift: string) {
  selectedShift = shift || 'all';
  listeners.forEach((listener) => listener());
}

export function subscribeDashboardShift(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
