'use client';
import { useEffect } from 'react';
import { bootstrapStore, refreshStore } from '@/lib/store';
import { bootstrapShifts } from '@/lib/shifts';
import { bootstrapOperators } from '@/lib/operators';

export default function StoreBootstrap() {
  useEffect(() => {
    bootstrapStore();
    bootstrapShifts();
    bootstrapOperators().catch((error) => console.warn('[MachineTrack] Operator bootstrap failed:', error));
    const refreshFromDb = () => {
      refreshStore().catch((error) => console.warn('[MachineTrack] Focus refresh failed:', error));
      bootstrapShifts();
      bootstrapOperators().catch((error) => console.warn('[MachineTrack] Operator focus refresh failed:', error));
    };
    window.addEventListener('focus', refreshFromDb);
    return () => window.removeEventListener('focus', refreshFromDb);
  }, []);
  return null;
}
