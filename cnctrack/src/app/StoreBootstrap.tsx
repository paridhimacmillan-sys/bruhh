'use client';
import { useEffect } from 'react';
import { bootstrapStore } from '@/lib/store';
import { bootstrapShifts } from '@/lib/shifts';
import { bootstrapOperators } from '@/lib/operators';

export default function StoreBootstrap() {
  useEffect(() => {
    bootstrapStore();
    bootstrapShifts();
    bootstrapOperators().catch((error) => console.warn('[MachineTrack] Operator bootstrap failed:', error));
  }, []);
  return null;
}
