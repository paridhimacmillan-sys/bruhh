import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardHeader from './components/DashboardHeader';
import KPIBentoGrid from './components/KPIBentoGrid';
import HourlyTrendChart from './components/HourlyTrendChart';
import MachineDailyChart from './components/MachineDailyChart';
import MachineStatusTable from './components/MachineStatusTable';
import ItemProductionTable from './components/ItemProductionTable';

export default function ProductionDashboardPage() {
  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-6">
        <DashboardHeader />
        <KPIBentoGrid />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <HourlyTrendChart />
          </div>
          <div className="xl:col-span-2">
            <MachineDailyChart />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <MachineStatusTable />
          </div>
          <div className="xl:col-span-1">
            <ItemProductionTable />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}