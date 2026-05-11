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

// --- MACHINES ---
export const MACHINES: Machine[] = [
  {
    id: 'machine-cnc1',
    machineType: 'CNC Lathe',
    machineNumber: 'CNC1',
    status: 'active',
    currentItem: 'item-a',
    operatorName: 'Amit Sharma',
    lastEntryTime: '05:00',
    assignedItems: ['item-a', 'item-b', 'item-d'],
    createdAt: '2026-01-15',
  },
  {
    id: 'machine-cnc2',
    machineType: 'CNC Milling',
    machineNumber: 'CNC2',
    status: 'active',
    currentItem: 'item-b',
    operatorName: 'Priya Nair',
    lastEntryTime: '05:00',
    assignedItems: ['item-b', 'item-c'],
    createdAt: '2026-01-15',
  },
  {
    id: 'machine-cnc3',
    machineType: 'CNC Lathe',
    machineNumber: 'CNC3',
    status: 'maintenance',
    currentItem: null,
    operatorName: null,
    lastEntryTime: '02:00',
    assignedItems: ['item-a', 'item-c', 'item-e'],
    createdAt: '2026-02-01',
  },
  {
    id: 'machine-cnc4',
    machineType: 'CNC Turning',
    machineNumber: 'CNC4',
    status: 'active',
    currentItem: 'item-c',
    operatorName: 'Suresh Patel',
    lastEntryTime: '05:00',
    assignedItems: ['item-c', 'item-d', 'item-e'],
    createdAt: '2026-02-10',
  },
  {
    id: 'machine-cnc5',
    machineType: 'CNC Grinding',
    machineNumber: 'CNC5',
    status: 'idle',
    currentItem: 'item-e',
    operatorName: 'Deepa Menon',
    lastEntryTime: '04:00',
    assignedItems: ['item-d', 'item-e'],
    createdAt: '2026-03-01',
  },
  {
    id: 'machine-cnc6',
    machineType: 'CNC Drilling',
    machineNumber: 'CNC6',
    status: 'offline',
    currentItem: null,
    operatorName: null,
    lastEntryTime: null,
    assignedItems: ['item-a', 'item-f'],
    createdAt: '2026-03-15',
  },
];

// --- ITEMS ---
export const ITEMS: Item[] = [
  {
    id: 'item-a',
    itemName: 'Spindle Shaft — Type A',
    defaultRate: 80,
    rates: [
      { machineId: 'machine-cnc1', rate: 80 },
      { machineId: 'machine-cnc3', rate: 70 },
      { machineId: 'machine-cnc6', rate: 75 },
    ],
    status: 'active',
    unit: 'pcs/hr',
    createdAt: '2026-01-15',
  },
  {
    id: 'item-b',
    itemName: 'Bearing Housing — B200',
    defaultRate: 60,
    rates: [
      { machineId: 'machine-cnc1', rate: 65 },
      { machineId: 'machine-cnc2', rate: 60 },
    ],
    status: 'active',
    unit: 'pcs/hr',
    createdAt: '2026-01-15',
  },
  {
    id: 'item-c',
    itemName: 'Valve Body — VB-40',
    defaultRate: 45,
    rates: [
      { machineId: 'machine-cnc2', rate: 48 },
      { machineId: 'machine-cnc3', rate: 42 },
      { machineId: 'machine-cnc4', rate: 45 },
    ],
    status: 'active',
    unit: 'pcs/hr',
    createdAt: '2026-02-01',
  },
  {
    id: 'item-d',
    itemName: 'Coupling Flange — CF-12',
    defaultRate: 90,
    rates: [
      { machineId: 'machine-cnc1', rate: 90 },
      { machineId: 'machine-cnc4', rate: 88 },
      { machineId: 'machine-cnc5', rate: 85 },
    ],
    status: 'active',
    unit: 'pcs/hr',
    createdAt: '2026-02-10',
  },
  {
    id: 'item-e',
    itemName: 'Gear Blank — GB-55',
    defaultRate: 55,
    rates: [
      { machineId: 'machine-cnc3', rate: 52 },
      { machineId: 'machine-cnc4', rate: 55 },
      { machineId: 'machine-cnc5', rate: 58 },
    ],
    status: 'active',
    unit: 'pcs/hr',
    createdAt: '2026-03-01',
  },
  {
    id: 'item-f',
    itemName: 'Nozzle Insert — NI-08',
    defaultRate: 120,
    rates: [
      { machineId: 'machine-cnc6', rate: 120 },
    ],
    status: 'inactive',
    unit: 'pcs/hr',
    createdAt: '2026-03-15',
  },
];

// --- PRODUCTION ENTRIES (today = 2026-05-10) ---
export const PRODUCTION_ENTRIES: ProductionEntry[] = [
  {
    id: 'entry-001',
    date: '2026-05-10',
    machineId: 'machine-cnc1',
    itemId: 'item-a',
    shift: 'A',
    entries: [
      { hour: 1, actual: 78, expected: 80 },
      { hour: 2, actual: 82, expected: 80 },
      { hour: 3, actual: 76, expected: 80 },
      { hour: 4, actual: 80, expected: 80 },
      { hour: 5, actual: 71, expected: 80 },
      { hour: 6, actual: 0, expected: 80 },
      { hour: 7, actual: 0, expected: 80 },
      { hour: 8, actual: 0, expected: 80 },
    ],
    status: 'submitted',
    operatorName: 'Amit Sharma',
    notes: '',
    totalActual: 387,
    totalExpected: 640,
  },
  {
    id: 'entry-002',
    date: '2026-05-10',
    machineId: 'machine-cnc2',
    itemId: 'item-b',
    shift: 'A',
    entries: [
      { hour: 1, actual: 62, expected: 60 },
      { hour: 2, actual: 59, expected: 60 },
      { hour: 3, actual: 61, expected: 60 },
      { hour: 4, actual: 58, expected: 60 },
      { hour: 5, actual: 63, expected: 60 },
      { hour: 6, actual: 0, expected: 60 },
      { hour: 7, actual: 0, expected: 60 },
      { hour: 8, actual: 0, expected: 60 },
    ],
    status: 'submitted',
    operatorName: 'Priya Nair',
    notes: '',
    totalActual: 303,
    totalExpected: 480,
  },
  {
    id: 'entry-003',
    date: '2026-05-10',
    machineId: 'machine-cnc4',
    itemId: 'item-c',
    shift: 'A',
    entries: [
      { hour: 1, actual: 44, expected: 45 },
      { hour: 2, actual: 46, expected: 45 },
      { hour: 3, actual: 43, expected: 45 },
      { hour: 4, actual: 40, expected: 45 },
      { hour: 5, actual: 38, expected: 45 },
      { hour: 6, actual: 0, expected: 45 },
      { hour: 7, actual: 0, expected: 45 },
      { hour: 8, actual: 0, expected: 45 },
    ],
    status: 'flagged',
    operatorName: 'Suresh Patel',
    notes: 'Tool change at H4 — slight dip expected',
    totalActual: 211,
    totalExpected: 360,
  },
  {
    id: 'entry-004',
    date: '2026-05-09',
    machineId: 'machine-cnc1',
    itemId: 'item-a',
    shift: 'A',
    entries: [
      { hour: 1, actual: 80, expected: 80 },
      { hour: 2, actual: 79, expected: 80 },
      { hour: 3, actual: 81, expected: 80 },
      { hour: 4, actual: 78, expected: 80 },
      { hour: 5, actual: 80, expected: 80 },
      { hour: 6, actual: 77, expected: 80 },
      { hour: 7, actual: 82, expected: 80 },
      { hour: 8, actual: 79, expected: 80 },
    ],
    status: 'submitted',
    operatorName: 'Amit Sharma',
    notes: '',
    totalActual: 636,
    totalExpected: 640,
  },
];

// --- HOURLY TREND DATA (for dashboard chart, today) ---
export const HOURLY_TREND = [
  { hour: 'H1', actual: 184, target: 185 },
  { hour: 'H2', actual: 187, target: 185 },
  { hour: 'H3', actual: 180, target: 185 },
  { hour: 'H4', actual: 178, target: 185 },
  { hour: 'H5', actual: 172, target: 185 },
  { hour: 'H6', actual: 0, target: 185 },
  { hour: 'H7', actual: 0, target: 185 },
  { hour: 'H8', actual: 0, target: 185 },
];

// --- MACHINE DAILY OUTPUT (for bar chart) ---
export const MACHINE_DAILY_OUTPUT = [
  { machine: 'CNC1', actual: 387, target: 640 },
  { machine: 'CNC2', actual: 303, target: 480 },
  { machine: 'CNC3', actual: 0, target: 360 },
  { machine: 'CNC4', actual: 211, target: 360 },
  { machine: 'CNC5', actual: 58, target: 464 },
  { machine: 'CNC6', actual: 0, target: 0 },
];

// --- UTILIZATION DATA ---
export const UTILIZATION_DATA = [
  { machine: 'CNC1', utilization: 60.5 },
  { machine: 'CNC2', utilization: 63.1 },
  { machine: 'CNC3', utilization: 0 },
  { machine: 'CNC4', utilization: 58.6 },
  { machine: 'CNC5', utilization: 12.5 },
  { machine: 'CNC6', utilization: 0 },
];

// --- ITEM PRODUCTION SUMMARY ---
export const ITEM_PRODUCTION_SUMMARY = [
  { itemId: 'item-a', itemName: 'Spindle Shaft — Type A', totalActual: 387, totalTarget: 640, machines: ['CNC1'] },
  { itemId: 'item-b', itemName: 'Bearing Housing — B200', totalActual: 303, totalTarget: 480, machines: ['CNC2'] },
  { itemId: 'item-c', itemName: 'Valve Body — VB-40', totalActual: 211, totalTarget: 360, machines: ['CNC4'] },
  { itemId: 'item-d', itemName: 'Coupling Flange — CF-12', totalActual: 58, totalTarget: 464, machines: ['CNC5'] },
  { itemId: 'item-e', itemName: 'Gear Blank — GB-55', totalActual: 0, totalTarget: 0, machines: [] },
];