'use client';

type Listener = () => void;
const listeners = new Set<Listener>();
let operators: string[] = [];

function notify() {
  listeners.forEach((listener) => listener());
}

export async function bootstrapOperators() {
  const response = await fetch('/api/operators', { cache: 'no-store' });
  if (!response.ok) throw new Error(`API /api/operators failed: ${response.status}`);
  operators = await response.json();
  notify();
}

export function getOperators() {
  return operators;
}

export async function addOperator(name: string) {
  const response = await fetch('/api/operators', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`API /api/operators failed: ${response.status}`);
  await bootstrapOperators();
}

export async function removeOperator(name: string) {
  const response = await fetch('/api/operators', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`API /api/operators failed: ${response.status}`);
  await bootstrapOperators();
}

export function subscribeOperators(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
