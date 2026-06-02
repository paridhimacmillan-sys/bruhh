'use client';

export interface ShiftDefinition {
  name: string;
  startTime: string;
  endTime: string;
}

type Listener = () => void;

const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { name: 'A', startTime: '06:00', endTime: '14:00' },
  { name: 'B', startTime: '14:00', endTime: '22:00' },
  { name: 'C', startTime: '22:00', endTime: '06:00' },
];
const listeners = new Set<Listener>();
let shifts: ShiftDefinition[] = [...DEFAULT_SHIFTS];

function notify() {
  listeners.forEach((listener) => listener());
}

export async function bootstrapShifts() {
  try {
    const response = await fetch('/api/shifts', { cache: 'no-store' });
    if (!response.ok) throw new Error(`API /api/shifts failed: ${response.status}`);
    shifts = (await response.json()) as ShiftDefinition[];
    notify();
  } catch (error) {
    console.warn('[MachineTrack] Shift bootstrap failed:', error);
  }
}

export function getShiftDefinitions(): ShiftDefinition[] {
  return shifts;
}

export function getShifts(): string[] {
  return shifts.map((shift) => shift.name);
}

export function getShiftHours(name: string): string[] {
  const shift = shifts.find((candidate) => candidate.name === name);
  if (!shift) return [];
  const [startHour, startMinute] = shift.startTime.split(':').map(Number);
  const [endHour, endMinute] = shift.endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const duration = ((end - start + 24 * 60) % (24 * 60)) || 24 * 60;
  const count = Math.ceil(duration / 60);
  return Array.from({ length: count }, (_, index) => {
    const minutes = (start + index * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
}

export async function addShift(shift: ShiftDefinition) {
  const response = await fetch('/api/shifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shift),
  });
  if (!response.ok) throw new Error(`API /api/shifts failed: ${response.status}`);
  await bootstrapShifts();
}

export async function removeShift(name: string) {
  const response = await fetch('/api/shifts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`API /api/shifts failed: ${response.status}`);
  await bootstrapShifts();
}

export function subscribeShifts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
