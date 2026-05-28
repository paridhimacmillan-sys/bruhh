'use client';
import { useEffect } from 'react';
import { bootstrapStore } from '@/lib/store';
import { bootstrapShifts } from '@/lib/shifts';

export default function StoreBootstrap() {
  useEffect(() => {
    bootstrapStore();
    bootstrapShifts();
  }, []);
  return null;
}
