// Backend integration point: replace all mock data with API calls to your production database

export type MachineStatus = 'active' | 'idle' | 'maintenance' | 'offline';
export type EntryStatus = 'draft' | 'submitted' | 'flagged';

export interface Machine {
  id: string;
  machineType: string;
  machineNumber: string;
  status: MachineStatus;
  currentItem: string | null;
  operatorName: string | null;
  lastEntryTime: string | null;
  assignedItems: string[];
  createdAt: string;
}

export interface ItemRate {
  machineId: string;
  rate: number;
}

export interface Item {
  id: string;
  itemName: string;
  defaultRate: number;
  rates: ItemRate[];
  status: 'active' | 'inactive';
  unit: string;
  createdAt: string;
}

export interface HourlyEntry {
  hour: number; // 1-8 per shift
  actual: number;
  expected: number;
}

export interface ProductionEntry {
  id: string;
  date: string;
  machineId: string;
  itemId: string;
  shift: 'A' | 'B' | 'C';
  entries: HourlyEntry[];
  status: EntryStatus;
  operatorName: string;
  notes: string;
  totalActual: number;
  totalExpected: number;
}

export const MACHINES: Machine[] = [];
export const ITEMS: Item[] = [];
export const PRODUCTION_ENTRIES: ProductionEntry[] = [];

export const HOURLY_TREND: { hour: string; actual: number; target: number }[] = [];
export const MACHINE_DAILY_OUTPUT: { machine: string; actual: number; target: number }[] = [];
export const UTILIZATION_DATA: { machine: string; utilization: number }[] = [];
export const ITEM_PRODUCTION_SUMMARY: {
  itemId: string;
  itemName: string;
  totalActual: number;
  totalTarget: number;
  machines: string[];
}[] = [];
