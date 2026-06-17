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
//
// Shift-edge allowances: 10 min off the FIRST hour cell of a shift (machine
// warm-up, setup) and 10 min off the LAST hour cell (cool-down, paperwork).
// These need to know the shift's hour list — that's why `hours` is now a
// parameter on the public API.
const SHIFT_OPENING_ALLOWANCE_MIN = 10;
const SHIFT_CLOSING_ALLOWANCE_MIN = 10;

// Tea allowances: 7 min off the 11:00 cell (mid-morning tea) and 7 min off
// the 18:00 cell (evening tea). Recognised by exact label match.
const TEA_ALLOWANCE_MIN = 7;
const TEA_HOUR_LABELS = new Set(["11:00", "18:00"]);

// Compute the productive minutes for an hour cell whose END is the given
// label time. Subtracts:
//   - any overlap with the global lunch break (13:00–13:30)
//   - shift opening allowance (first cell of `hours`)
//   - shift closing allowance (last cell of `hours`)
//   - tea allowance (11:00 and 18:00 labels)
//
// `hours` is the array of hour labels for the shift; pass an empty array
// when shift context isn't available and only lunch/tea should apply.
//
// Examples (for the global 13:00–13:30 lunch, 08:00–20:00 shift):
//   hourLabel="09:00" (first hour) → 60 - 10 = 50 min
//   hourLabel="11:00"              → 60 - 7  = 53 min (tea)
//   hourLabel="14:00" (lunch)      → 60 - 30 = 30 min
//   hourLabel="18:00"              → 60 - 7  = 53 min (tea)
//   hourLabel="20:00" (last hour)  → 60 - 10 = 50 min
//   hourLabel="12:00"              → 60      = 60 min (no allowance)
export function workedMinutesForHour(
  hourLabel: string,
  hours: string[] = []
): number {
  const [h, m] = hourLabel.split(":").map(Number);
  const endMin = h * 60 + m;
  const startMin = endMin - 60;

  // Lunch overlap (existing behaviour)
  const lunchStart = Math.max(startMin, LUNCH_START_MIN);
  const lunchEnd = Math.min(endMin, LUNCH_END_MIN);
  let deduction = Math.max(0, lunchEnd - lunchStart);

  // Shift-edge allowances
  if (hours.length > 0) {
    if (hourLabel === hours[0]) deduction += SHIFT_OPENING_ALLOWANCE_MIN;
    if (hourLabel === hours[hours.length - 1])
      deduction += SHIFT_CLOSING_ALLOWANCE_MIN;
  }

  // Tea allowances
  if (TEA_HOUR_LABELS.has(hourLabel)) deduction += TEA_ALLOWANCE_MIN;

  return Math.max(0, 60 - deduction);
}

// Compute the expected (target) production for one hour cell given the
// per-hour rate and the hour label. Pass `hours` so shift-edge allowances
// can be applied; pass [] to skip them.
export function expectedForHour(
  rate: number,
  hourLabel: string,
  hours: string[] = []
): number {
  if (rate <= 0) return 0;
  const minutes = workedMinutesForHour(hourLabel, hours);
  // Round to nearest integer — we deal in whole pieces, not fractions.
  return Math.round((rate * minutes) / 60);
}

// Round a Date to the nearest hour. 08:05 → 08:00, 08:30 → 09:00, 08:29 → 08:00.
// Used by shift-total target math so a save-click at 08:05 counts as the 8 AM
// hour and a save-click at 19:50 counts as the 8 PM hour.
function roundToNearestHour(d: Date): Date {
  const r = new Date(d);
  if (r.getMinutes() >= 30) r.setHours(r.getHours() + 1);
  r.setMinutes(0, 0, 0);
  return r;
}

// Shift-total mode: compute target from elapsed time between when the
// operator clicked "Save Opening" and "Save Closing". Timestamps are
// rounded to the nearest hour, then the lunch window (13:00–13:30) is
// subtracted if it falls within the range.
//
// Mirrors the same math the server uses for authoritative validation.
export function expectedForShiftElapsed(
  rate: number,
  openingAt: Date | null,
  closingAt: Date | null
): number {
  if (rate <= 0 || !openingAt || !closingAt) return 0;
  const oH = roundToNearestHour(openingAt);
  const cH = roundToNearestHour(closingAt);
  let workedMin = Math.max(0, (cH.getTime() - oH.getTime()) / 60000);
  // Subtract lunch overlap on the opening date.
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
  // Second operator name (handover mid-shift). Empty string if no handover.
  // Must be filled together with operatorChangeTime.
  operatorName2: string;
  operatorChangeTime: string; // "HH:MM" or ""
  notes: string;
  lockedHours: number[];
  // Per-hour save timestamps (ISO strings), keyed by stringified hourIdx.
  // Used to enforce the 10-min operator-undo window.
  hourSavedAt: Record<string, string>;
  // Machine's tracking mode. For 'shift_total' the grid renders a single
  // opening+closing cell instead of the hourly columns.
  trackingMode: "hourly" | "shift_total";
  // Shift-total only: timestamps when operator clicked Save Opening / Closing.
  // Server rounds to nearest hour for target math; we store the actual time.
  openingAt: Date | null;
  closingAt: Date | null;
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
        dirty: false,
      });
      continue;
    }

    // One row per saved entry — supports multi-item-per-machine (shift splitting).
    for (const existing of machineEntries) {
      const item = existing.itemId != null ? itemById.get(existing.itemId) ?? null : null;
      // Resolve the per-machine rate from item.rates. `rate` is pcs/hr — the
      // theoretical max. Per-hour `expected` is rate scaled down for lunch.
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
        return {
          hour,
          closingReading: e?.closingReading ?? null,
          actual: e?.actual ?? 0,
          expected: expectedForHour(rate, hour, safeH),
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
