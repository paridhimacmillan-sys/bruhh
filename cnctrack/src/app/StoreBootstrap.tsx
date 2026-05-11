'use client';
import { useEffect } from 'react';
import { bootstrapStore } from '@/lib/store';

export default function StoreBootstrap() {
  useEffect(() => {
    bootstrapStore();
  }, []);
  return null;
}
