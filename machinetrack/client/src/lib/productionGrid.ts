import type { Machine, Item, Shift, ProductionEntry, HourlyEntry, ItemRate, MachineShift } from "@shared/schema";

// Global lunch break: production pauses 13:00–13:30 every day on every shift.
// The hour cell covering this window gets a reduced "expected" rate so that
// efficiency math stays honest (you can't make a full hour of parts in
// 30 minutes). Stored as minutes-since-midnight to keep math simple.
export const LUNCH_START_MIN = 13 * 60; // 13:00
export const LUNCH_END_MIN = 13 * 60 + 30; // 13:30

// Per-hour allowances deducted from the worked-minutes used for target math.
// Stack additively on top of the lunch overlap — e.g. if 11:00 happens to be
// the first hour of a shift AND a tea slot, both 10 + 7 = 17 min are removed.
const SHIFT_OPENING_ALLOWANCE_MIN = 10;
const SHIFT_CLOSING_ALLOWANCE_MIN = 10;

// Tea allowances: 7 min off the 11:00 cell and 7 min off the 18:00 cell.
const TEA_ALLOWANCE_MIN = 7;
const TEA_HOUR_LABELS = new Set(["11:00", "18:00"]);

export function workedMinutesForHour(
  hourLabel: string,
  hours: string[] = []
): number {
  const [h, m] = hourLabel.split(":").map(Number);
  const endMin = h * 60 + m;
  const startMin = endMin - 60;

  const lunchStart = Math.max(startMin, LUNCH_START_MIN);
  const lunchEnd = Math.min(endMin, LUNCH_END_MIN);
  let deduction = Math.max(0, lunchEnd - lunchStart);

  if (hours.length > 0) {
    if (hourLabel === hours[0]) deduction += SHIFT_OPENING_ALLOWANCE_MIN;
    if (hourLabel === hours[hours.length - 1])
      deduction += SHIFT_CLOSING_ALLOWANCE_MIN;
  }

  if (TEA_HOUR_LABELS.has(hourLabel)) deduction += TEA_ALLOWANCE_MIN;

  return Math.max(0, 60 - deduction);
}

export function expectedForHour(
  rate: number,
  hourLabel: string,
  hours: string[] = []
): number {
  if (rate <= 0) return 0;
  const minutes = workedMinutesForHour(hourLabel, hours);
  return Math.round((rate * minutes) / 60);
}

// PHYSICAL maximum production for an hour cell. Lunch overlap is still
// subtracted (real clock gap); tea + shift-edge allowances are added back
// since operator might have worked through them.
export function maxAllowedForHour(
  rate: number,
  hourLabel: string,
  hours: string[] = []
): number {
  if (rate <= 0) return 0;
  const [h, m] = hourLabel.split(":").map(Number);
  const endMin = h * 60 + m;
  const startMin = endMin - 60;
  const lunchOverlap = Math.max(
    0,
    Math.min(endMin, LUNCH_END_MIN) - Math.max(startMin, LUNCH_START_MIN)
  );
  const physicalMax = 60 - lunchOverlap;
  return Math.round((rate * physicalMax) / 60);
}

function roundToNearestHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() >= 30) r.setHours(r.getHours() + 1);
  r.setMinutes(0, 0, 0);
  return r;
}

export function expectedForShiftElapsed(
  rate: number,
  openingAt: Date | null,
  closingAt: Date | null
): number {
  if (rate <= 0 || !openingAt || !closingAt) return 0;
  const oH = roundToNearestHour(openingAt);
  const cH = roundToNearestHour(closingAt);
  let workedMin = Math.max(0, (cH.getTime() - oH.getTime()) / 60000);
  const lunchStart = new Date(oH);
  lunchStart.setHours(13, 0, 0, 0);
  const lunchEnd = new Date(oH);
  lunchEnd.setHours(13, 30, 0, 0);
  const overlapStart = Math.max(oH.getTime(), lunchStart.getTime());
  const overlapEnd = Math.min(cH.getTime(), lunchEnd.getTime());
  const lunchOverlap = Math.max(0, (overlapEnd - overlapStart) / 60000);
  workedMin -= lunchOverlap;
  return Math.round((rate * workedMin) / 60);
}

export function computeShiftHours(shift: Shift): string[] {
  const [sH, sM] = shift.startTime.split(":").map(Number);
  const [eH, eM] = shift.endTime.split(":").map(Number);
  const start = sH * 60 + sM;
  let end = eH * 60 + eM;
  if (end <= start) end += 24 * 60;
  const hours: string[] = [];
  for (let t = start + 60; t <= end; t += 60) {
    const minutes = t % (24 * 60);
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    hours.push(`${h}:${m}`);
  }
  return hours;
}

export function rateFor(item: Item | undefined, machine: Machine | undefined): number {
  if (!machine || !item) return 0;
  const rates = (item.rates as ItemRate[] | null) ?? [];
  const found = rates.find((r) => r.machineId === machine.id);
  return found?.rate ?? 0;
}

export interface GridRow {
  rowKey: string;
  machineId: number;
  machine: Machine;
  itemId: number | null;
  item: Item | null;
  expected: number;
  openingReading: number;
  entries: HourlyEntry[];
  operatorName: string;
  operatorName2: string;
  operatorChangeTime: string;
  notes: string;
  lockedHours: number[];
  hourSavedAt: Record<string, string>;
  trackingMode: "hourly" | "shift_total";
  openingAt: Date | null;
  closingAt: Date | null;
  // Index into the shift's hour list at which this row started running.
  // Null = ran from start of shift (default). Non-null = set when "+ Split"
  // was used and operator picked a starting hour. The implicit END is the
  // startHourIdx of the next row for the same machine (consumer scans pairs).
  startHourIdx: number | null;
  dirty: boolean;
}

// Build the initial grid: one row per (machine, item) assignment.
// Same machine can appear N times if it runs N different items (split row).
export function buildRows(
  machines: Machine[],
  items: Item[],
  hours: string[],
  entries: ProductionEntry[],
  currentShiftId: number | null = null,
  machineShifts: MachineShift[] = []
): GridRow[] {
  const safeM = Array.isArray(machines) ? machines : [];
  const safeI = Array.isArray(items) ? items : [];
  const safeH = Array.isArray(hours) ? hours : [];
  const safeE = Array.isArray(entries) ? entries : [];
  const safeMS = Array.isArray(machineShifts) ? machineShifts : [];

  const machineToShifts = new Map<number, Set<number>>();
  for (const ms of safeMS) {
    if (!machineToShifts.has(ms.machineId)) {
      machineToShifts.set(ms.machineId, new Set());
    }
    machineToShifts.get(ms.machineId)!.add(ms.shiftId);
  }

  const activeMachines = safeM
    .filter((m) => {
      if (m?.status !== "active") return false;
      if (currentShiftId == null) return true;
      const assigned = machineToShifts.get(m.id);
      if (!assigned || assigned.size === 0) return true;
      return assigned.has(currentShiftId);
    })
    .sort((a, b) =>
      a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true })
    );

  const itemById = new Map<number, Item>();
  for (const i of safeI) itemById.set(i.id, i);

  const entriesByMachine = new Map<number, ProductionEntry[]>();
  for (const e of safeE) {
    if (!entriesByMachine.has(e.machineId)) entriesByMachine.set(e.machineId, []);
    entriesByMachine.get(e.machineId)!.push(e);
  }

  const rows: GridRow[] = [];

  for (const machine of activeMachines) {
    const machineEntries = entriesByMachine.get(machine.id) ?? [];

    if (machineEntries.length === 0) {
      rows.push({
        rowKey: `new-${machine.id}-0`,
        machineId: machine.id,
        machine,
        itemId: null,
        item: null,
        expected: 0,
        openingReading: 0,
        entries: safeH.map((hour) => ({
          hour,
          closingReading: null,
          actual: 0,
          expected: 0,
        })),
        operatorName: "",
        operatorName2: "",
        operatorChangeTime: "",
        notes: "",
        lockedHours: [],
        hourSavedAt: {},
        trackingMode:
          ((machine as any).trackingMode === "shift_total"
            ? "shift_total"
            : "hourly") as "hourly" | "shift_total",
        openingAt: null,
        closingAt: null,
        startHourIdx: null,
        dirty: false,
      });
      continue;
    }

    // Sort split rows by startHourIdx so they appear in chronological order.
    // Null/0 (the original row that ran from shift start) sorts first; higher
    // indices (split rows added later) come after.
    const sortedEntries = [...machineEntries].sort((a, b) => {
      const aIdx = (a as any).startHourIdx ?? 0;
      const bIdx = (b as any).startHourIdx ?? 0;
      return aIdx - bIdx;
    });

    // Each row's active window [from, to]: from = its own startHourIdx (or 0),
    // to = the hour BEFORE the next row's startHourIdx (or last hour for the
    // last row). Hours outside the window get expected=0 so they don't bloat
    // the row's total target.
    const windows: Array<{ from: number; to: number }> = sortedEntries.map(
      (e, i) => {
        const from = (e as any).startHourIdx ?? 0;
        const nextFrom =
          i + 1 < sortedEntries.length
            ? ((sortedEntries[i + 1] as any).startHourIdx ?? safeH.length)
            : safeH.length;
        return { from, to: nextFrom - 1 };
      }
    );

    for (let entryIdx = 0; entryIdx < sortedEntries.length; entryIdx++) {
      const existing = sortedEntries[entryIdx];
      const win = windows[entryIdx];
      const item = existing.itemId != null ? itemById.get(existing.itemId) ?? null : null;
      let rate = 0;
      if (item) {
        const rates = Array.isArray(item.rates) ? (item.rates as ItemRate[]) : [];
        rate = rates.find((r) => r?.machineId === machine.id)?.rate ?? 0;
      }

      const existingEntries = Array.isArray(existing.entries)
        ? (existing.entries as HourlyEntry[])
        : [];
      const hourlyEntries: HourlyEntry[] = safeH.map((hour, idx) => {
        const e = existingEntries[idx];
        // Inside this row's active window: normal target. Outside: 0.
        const insideWindow = idx >= win.from && idx <= win.to;
        return {
          hour,
          closingReading: e?.closingReading ?? null,
          actual: e?.actual ?? 0,
          expected: insideWindow ? expectedForHour(rate, hour, safeH) : 0,
          reasonId: e?.reasonId ?? null,
        };
      });

      rows.push({
        rowKey: `saved-${existing.id}`,
        machineId: machine.id,
        machine,
        itemId: existing.itemId,
        item,
        expected: rate,
        openingReading: existing.openingReading ?? 0,
        entries: hourlyEntries,
        operatorName: existing.operatorName ?? "",
        operatorName2: existing.operatorName2 ?? "",
        operatorChangeTime: existing.operatorChangeTime ?? "",
        notes: existing.notes ?? "",
        lockedHours: Array.isArray(existing.lockedHours)
          ? (existing.lockedHours as number[])
          : [],
        hourSavedAt:
          (existing.hourSavedAt as Record<string, string> | null) ?? {},
        trackingMode:
          ((machine as any).trackingMode === "shift_total"
            ? "shift_total"
            : "hourly") as "hourly" | "shift_total",
        openingAt: existing.openingAt ? new Date(existing.openingAt) : null,
        closingAt: existing.closingAt ? new Date(existing.closingAt) : null,
        startHourIdx: (existing as any).startHourIdx ?? null,
        dirty: false,
      });
    }
  }

  return rows;
}

export function getItemsForMachine(
  machineId: number,
  items: Item[]
): Array<{ item: Item; rate: number }> {
  return items.flatMap((item) => {
    if (item.status !== "active") return [];
    const rates = Array.isArray(item.rates) ? (item.rates as ItemRate[]) : [];
    const rate = rates.find((r) => r?.machineId === machineId)?.rate ?? 0;
    if (rate <= 0) return [];
    return [{ item, rate }];
  });
}

export function recomputeActuals(
  openingReading: number,
  entries: HourlyEntry[]
): HourlyEntry[] {
  let prev = openingReading;
  return entries.map((e) => {
    if (e.closingReading == null) {
      return { ...e, actual: 0 };
    }
    const actual = Math.max(0, e.closingReading - prev);
    prev = e.closingReading;
    return { ...e, actual };
  });
}
