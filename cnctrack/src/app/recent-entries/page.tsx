export const dynamic = 'force-dynamic';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RecentEntriesClient from './components/RecentEntriesClient';

export default function RecentEntriesPage() {
  return (
    <AppLayout>
      <RecentEntriesClient />
    </AppLayout>
  );
}
