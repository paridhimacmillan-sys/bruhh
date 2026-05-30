export const dynamic = 'force-dynamic';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProductionEntryClient from './components/ProductionEntryClient';

export default function ProductionEntryPage() {
  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
        <ProductionEntryClient />
      </div>
    </AppLayout>
  );
}