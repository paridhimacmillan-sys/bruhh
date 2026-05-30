'use client';
import React, { useState, useEffect } from 'react';
import {
  Activity,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Gauge,
} from 'lucide-react';
import { getDashboardData, subscribe } from '@/lib/store';
import { getTodayISOLocal } from '@/lib/date';
import Icon from '@/components/ui/AppIcon';


export default function KPIBentoGrid() {
  const [dashData, setDashData] = useState(() => getDashboardData(getTodayISOLocal(), 'A'));

  useEffect(() => {
    const unsub = subscribe(() => {
      setDashData(getDashboardData(getTodayISOLocal(), 'A'));
    });
    return unsub;
  }, []);

  const { totalActual, totalExpected, efficiency, onTargetMachines, downMachines, activeMachines, avgHourlyGap } = dashData;

  const KPI_CARDS = [
    {
      id: 'kpi-total-output',
      hero: true,
      label: 'Total Output Today',
      value: totalActual?.toLocaleString(),
      unit: 'pcs',
      sub: `vs ${totalExpected?.toLocaleString()} target`,
      subColor: efficiency >= 80 ? 'text-success' : 'text-danger',
      delta: `${efficiency >= 0 ? efficiency : 0}% efficiency`,
      deltaUp: efficiency >= 80,
      icon: Layers,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      cardClass: 'card-base',
    },
    {
      id: 'kpi-utilization',
      hero: false,
      label: 'Fleet Utilization',
      value: efficiency?.toString(),
      unit: '%',
      sub: `Across ${activeMachines?.length} active machines`,
      subColor: 'text-muted-foreground',
      delta: efficiency >= 80 ? 'On track' : efficiency >= 50 ? 'Needs attention' : 'Critical — below 50%',
      deltaUp: efficiency >= 80,
      icon: Gauge,
      iconBg: efficiency >= 80 ? 'bg-success/10' : 'bg-warning/10',
      iconColor: efficiency >= 80 ? 'text-success' : 'text-warning',
      cardClass: efficiency >= 80 ? 'card-base' : 'warning-card',
    },
    {
      id: 'kpi-on-target',
      hero: false,
      label: 'On-Target Machines',
      value: onTargetMachines?.length?.toString(),
      unit: `/ ${activeMachines?.length}`,
      sub: onTargetMachines?.length > 0
        ? `${onTargetMachines?.map((m) => m?.machineNumber)?.join(', ')} meeting target`
        : 'No machines on target',
      subColor: onTargetMachines?.length > 0 ? 'text-success' : 'text-danger',
      delta: onTargetMachines?.length < activeMachines?.length
        ? `${activeMachines?.length - onTargetMachines?.length} machine(s) behind`
        : 'All machines on target',
      deltaUp: onTargetMachines?.length === activeMachines?.length,
      icon: CheckCircle2,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
      cardClass: 'card-base',
    },
    {
      id: 'kpi-hourly-gap',
      hero: false,
      label: 'Avg Hourly Gap',
      value: avgHourlyGap?.toString(),
      unit: 'pcs',
      sub: 'Avg shortfall per logged hour',
      subColor: 'text-muted-foreground',
      delta: avgHourlyGap === 0 ? 'No gap — on target' : `${avgHourlyGap} pcs/hr shortfall`,
      deltaUp: avgHourlyGap === 0,
      icon: TrendingDown,
      iconBg: avgHourlyGap > 0 ? 'bg-danger/10' : 'bg-success/10',
      iconColor: avgHourlyGap > 0 ? 'text-danger' : 'text-success',
      cardClass: avgHourlyGap > 10 ? 'alert-card' : 'card-base',
    },
    {
      id: 'kpi-shift-efficiency',
      hero: false,
      label: 'Shift A Efficiency',
      value: efficiency?.toString(),
      unit: '%',
      sub: `${totalActual?.toLocaleString()} of ${totalExpected?.toLocaleString()} expected`,
      subColor: 'text-muted-foreground',
      delta: 'Shift in progress',
      deltaUp: efficiency >= 80,
      icon: Activity,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
      cardClass: 'card-base',
    },
    {
      id: 'kpi-machines-down',
      hero: false,
      label: 'Machines Down',
      value: downMachines?.length?.toString(),
      unit: '',
      sub: downMachines?.length > 0
        ? downMachines?.map((m) => `${m?.machineNumber} ${m?.status}`)?.join(', ')
        : 'All machines operational',
      subColor: downMachines?.length > 0 ? 'text-danger' : 'text-success',
      delta: downMachines?.length > 0 ? 'Action required' : 'No issues',
      deltaUp: downMachines?.length === 0,
      icon: AlertTriangle,
      iconBg: downMachines?.length > 0 ? 'bg-danger/10' : 'bg-success/10',
      iconColor: downMachines?.length > 0 ? 'text-danger' : 'text-success',
      cardClass: downMachines?.length > 0 ? 'alert-card' : 'card-base',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {KPI_CARDS?.map((card) => {
        const Icon = card?.icon;
        return (
          <div
            key={card?.id}
            className={`${card?.cardClass} card-hover p-5 ${
              card?.hero ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2 2xl:col-span-2' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {card?.label}
              </p>
              <span className={`p-1.5 rounded-md ${card?.iconBg}`}>
                <Icon size={16} className={card?.iconColor} />
              </span>
            </div>
            <div className="flex items-end gap-1.5 mb-1.5">
              <span className={card?.hero ? 'text-hero-metric' : 'text-metric-md'}>
                {card?.value}
              </span>
              {card?.unit && (
                <span className="text-sm text-muted-foreground font-medium mb-1">
                  {card?.unit}
                </span>
              )}
            </div>
            <p className={`text-xs font-medium ${card?.subColor}`}>{card?.sub}</p>
            <p className="text-xs text-muted-foreground mt-1">{card?.delta}</p>
          </div>
        );
      })}
    </div>
  );
}
