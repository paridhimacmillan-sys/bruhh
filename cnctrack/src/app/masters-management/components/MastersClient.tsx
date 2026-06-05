'use client';
import React, { useState } from 'react';
import MachineTab from './MachineTab';
import ItemTab from './ItemTab';
import ShiftTab from './ShiftTab';
import OperatorTab from './OperatorTab';
import OperatorAccountsTab from './OperatorAccountsTab';

const TABS = [
  { key: 'tab-machines', label: 'Machine Master', id: 'machines' },
  { key: 'tab-items', label: 'Item Master', id: 'items' },
  { key: 'tab-shifts', label: 'Shift Master', id: 'shifts' },
  { key: 'tab-operators', label: 'Shift Operator', id: 'operators' },
  { key: 'tab-accounts', label: 'Operator Accounts', id: 'accounts' },
];

type TabId = 'machines' | 'items' | 'shifts' | 'operators' | 'accounts';

export default function MastersClient() {
  const [activeTab, setActiveTab] = useState<TabId>('machines');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Masters Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure machines and items — reference data for all production entries
        </p>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="fade-in">
        {activeTab === 'machines' ? <MachineTab /> :
         activeTab === 'items' ? <ItemTab /> :
         activeTab === 'shifts' ? <ShiftTab /> :
         activeTab === 'operators' ? <OperatorTab /> :
         <OperatorAccountsTab />}
      </div>
    </div>
  );
}
