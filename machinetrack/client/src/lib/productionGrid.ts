import type { Machine, Item, Shift, ProductionEntry, HourlyEntry, ItemRate } from "@shared/schema";

// Compute the hour labels for a shift. Hours wrap past midnight if endTime < startTime.
// Returns 'HH:MM' strings, one per hour the shift covers.
export function computeShiftHours(shift: Shift): string[] {
  const [sH, sM] = shift.startTime.split(":").map(Number);
  const [eH, eM] = shift.endTime.split(":").map(Number);
  const start = sH * 60 + sM;
  let end = eH * 60 + eM;
  if (end <= start) end += 24 * 60; // wraps midnight
  const hours: string[] = [];
  for (let t = start; t < end; t += 60) {
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
  machineId: number;
  machine: Machine;
  // itemId is non-null now — every grid row corresponds to a real (machine, item) pair.
  itemId: number;
  item: Item;
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
export function buildRows(
  machines: Machine[],
  items: Item[],
  hours: string[],
  entries: ProductionEntry[]
): GridRow[] {
  // Defensive: every input could be undefined if a query is still loading
  // or returned an error. Treat as empty rather than crashing.
  const safeM = Array.isArray(machines) ? machines : [];
  const safeI = Array.isArray(items) ? items : [];
  const safeH = Array.isArray(hours) ? hours : [];
  const safeE = Array.isArray(entries) ? entries : [];

  const activeMachines = safeM.filter((m) => m?.status === "active");
  const activeItems = safeI.filter((i) => i?.status === "active");

  const rows: GridRow[] = [];

  for (const machine of activeMachines) {
    const assignedItems = activeItems.flatMap((item) => {
      const rates = Array.isArray(item.rates) ? (item.rates as ItemRate[]) : [];
      const rate = rates.find((r) => r?.machineId === machine.id)?.rate ?? 0;
      return rate > 0 ? [{ item, rate }] : [];
    });

    if (assignedItems.length === 0) continue;

    for (const { item, rate } of assignedItems) {
      const existing = safeE.find(
        (e) => e.machineId === machine.id && e.itemId === item.id
      );

      const existingEntries = Array.isArray(existing?.entries)
        ? (existing!.entries as HourlyEntry[])
        : [];
      const hourlyEntries: HourlyEntry[] = safeH.map((hour, idx) => {
        const e = existingEntries[idx];
        return {
          hour,
          closingReading: e?.closingReading ?? null,
          actual: e?.actual ?? 0,
          expected: rate,
        };
      });

      rows.push({
        machineId: machine.id,
        machine,
        itemId: item.id,
        item,
        expected: rate,
        openingReading: existing?.openingReading ?? 0,
        entries: hourlyEntries,
        operatorName: existing?.operatorName ?? "",
        notes: existing?.notes ?? "",
        lockedHours: Array.isArray(existing?.lockedHours)
          ? (existing!.lockedHours as number[])
          : [],
        dirty: false,
      });
    }
  }

  return rows;
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
