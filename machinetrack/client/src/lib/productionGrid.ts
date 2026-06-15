import type { Machine, Item, Shift, ProductionEntry, HourlyEntry, ItemRate, MachineShift } from "@shared/schema";

// Compute the hour labels for a shift. Each label is the time when the closing
// reading is taken — i.e. the END of that worked hour. For an 08:00 → 20:00 shift,
// the operator does an opening read at 08:00, then closing reads at 09:00, 10:00,
// ..., 20:00. So we return ['09:00', '10:00', ..., '20:00'] — 12 read times.
// Hours wrap past midnight if endTime < startTime.
export function computeShiftHours(shift: Shift): string[] {
  const [sH, sM] = shift.startTime.split(":").map(Number);
  const [eH, eM] = shift.endTime.split(":").map(Number);
  const start = sH * 60 + sM;
  let end = eH * 60 + eM;
  if (end <= start) end += 24 * 60; // wraps midnight
  const hours: string[] = [];
  // Step in 1-hour increments, starting at start+60 so the first label is the
  // close of the first worked hour. Include `end` itself (<=, not <).
  for (let t = start + 60; t <= end; t += 60) {
    const minutes = t % (24 * 60);
    const h = Math.floor(minutes / 60).toString().padStart(2, "0");
    const m = (minutes % 60).toString().padStart(2, "0");
    hours.push(`${h}:${m}`);
  }
  return hours;
}

// Resolve the rate for an item on a specific machine.
// Returns 0 if the item isn't assigned to that machine.
export function rateFor(item: Item | undefined, machine: Machine | undefined): number {
  if (!machine || !item) return 0;
  const rates = (item.rates as ItemRate[] | null) ?? [];
  const found = rates.find((r) => r.machineId === machine.id);
  return found?.rate ?? 0;
}

export interface GridRow {
  // Unique row identifier — needed because the same machine can have multiple
  // rows in a single day (operator splits the shift between two items).
  // Stable across re-renders for new rows, equals the production_entries.id
  // for rows backed by a saved entry, or a synthetic negative id for fresh rows.
  rowKey: string;
  machineId: number;
  machine: Machine;
  // null when no item picked yet — row is shown but inputs are disabled
  itemId: number | null;
  item: Item | null;
  // Hourly target rate (pcs/hr) for the picked item on this machine. 0 when no item.
  expected: number;
  openingReading: number;
  entries: HourlyEntry[];
  operatorName: string;
  notes: string;
  lockedHours: number[];
  dirty: boolean;
}

// Build the initial grid: one row per (machine, item) assignment.
// Same machine can appear N times if it runs N different items.
// `currentShiftId` + `machineShifts` filter to only machines assigned to that
// shift. Pass currentShiftId=null to include all machines (back-compat).
export function buildRows(
  machines: Machine[],
  items: Item[],
  hours: string[],
  entries: ProductionEntry[],
  currentShiftId: number | null = null,
  machineShifts: MachineShift[] = []
): GridRow[] {
  // Defensive: every input could be undefined if a query is still loading
  // or returned an error. Treat as empty rather than crashing.
  const safeM = Array.isArray(machines) ? machines : [];
  const safeI = Array.isArray(items) ? items : [];
  const safeH = Array.isArray(hours) ? hours : [];
  const safeE = Array.isArray(entries) ? entries : [];
  const safeMS = Array.isArray(machineShifts) ? machineShifts : [];

  // Build lookup: machineId → set of shiftIds it's assigned to.
  // A machine with NO entries in the assignment table is treated as "runs in
  // all shifts" — back-compat for orgs that haven't set up assignments yet.
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
      // If machine has NO assignments at all, include it (default: all shifts).
      // If it HAS assignments, the current shift must be one of them.
      if (!assigned || assigned.size === 0) return true;
      return assigned.has(currentShiftId);
    })
    .sort((a, b) =>
      // Natural sort so "CNC 2" comes before "CNC 10"
      a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true })
    );

  // Index items by id for fast lookup
  const itemById = new Map<number, Item>();
  for (const i of safeI) itemById.set(i.id, i);

  // Group saved entries by machineId for this date+shift
  const entriesByMachine = new Map<number, ProductionEntry[]>();
  for (const e of safeE) {
    if (!entriesByMachine.has(e.machineId)) entriesByMachine.set(e.machineId, []);
    entriesByMachine.get(e.machineId)!.push(e);
  }

  const rows: GridRow[] = [];

  for (const machine of activeMachines) {
    const machineEntries = entriesByMachine.get(machine.id) ?? [];

    if (machineEntries.length === 0) {
      // No saved entry for this machine today — show ONE empty row with item
      // picker disabled until user picks an item.
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
        notes: "",
        lockedHours: [],
        dirty: false,
      });
      continue;
    }

    // One row per saved entry — supports multi-item-per-machine (shift splitting).
    for (const existing of machineEntries) {
      const item = existing.itemId != null ? itemById.get(existing.itemId) ?? null : null;
      // Resolve the per-machine rate from item.rates
      let expected = 0;
      if (item) {
        const rates = Array.isArray(item.rates) ? (item.rates as ItemRate[]) : [];
        expected = rates.find((r) => r?.machineId === machine.id)?.rate ?? 0;
      }

      const existingEntries = Array.isArray(existing.entries)
        ? (existing.entries as HourlyEntry[])
        : [];
      const hourlyEntries: HourlyEntry[] = safeH.map((hour, idx) => {
        const e = existingEntries[idx];
        return {
          hour,
          closingReading: e?.closingReading ?? null,
          actual: e?.actual ?? 0,
          expected,
          reasonId: e?.reasonId ?? null,
        };
      });

      rows.push({
        rowKey: `saved-${existing.id}`,
        machineId: machine.id,
        machine,
        itemId: existing.itemId,
        item,
        expected,
        openingReading: existing.openingReading ?? 0,
        entries: hourlyEntries,
        operatorName: existing.operatorName ?? "",
        notes: existing.notes ?? "",
        lockedHours: Array.isArray(existing.lockedHours)
          ? (existing.lockedHours as number[])
          : [],
        dirty: false,
      });
    }
  }

  return rows;
}

// Helper: given a machine, return the items that have a rate defined for it.
// Used by the per-row item picker dropdown.
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

// Recompute the `actual` values for a row given an opening reading and entries.
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
