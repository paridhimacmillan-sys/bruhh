import type { Machine, Item, Shift, ProductionEntry, HourlyEntry } from "@shared/schema";

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

// Resolve the expected rate for a given (machine, item) pair.
// 1. If the item has a per-machine override for this machine, use that
// 2. Otherwise, fall back to the machine's target rate (each machine has its own speed)
// 3. As a last resort, fall back to the item's defaultRate field (legacy data)
export function rateFor(item: Item | undefined, machine: Machine | undefined): number {
  if (!machine) return 0;
  if (item) {
    const overrides =
      (item.rates as Array<{ machineId: number; rate: number }> | null) ?? [];
    const found = overrides.find((r) => r.machineId === machine.id);
    if (found) return found.rate;
  }
  return machine.targetRate;
}

export interface GridRow {
  machineId: number;
  machine: Machine;
  itemId: number | null;
  item: Item | undefined;
  openingReading: number;
  entries: HourlyEntry[];
  operatorName: string;
  notes: string;
  lockedHours: number[];
  // Track dirtiness for client-side "unsaved" indicator
  dirty: boolean;
}

// Build the initial grid from machines + existing entries.
// One row per machine. Missing entries get empty HourlyEntry slots.
export function buildRows(
  machines: Machine[],
  items: Item[],
  hours: string[],
  entries: ProductionEntry[]
): GridRow[] {
  return machines
    .filter((m) => m.status === "active")
    .map((machine) => {
      const existing = entries.find((e) => e.machineId === machine.id);
      // Pick the item:
      //   1. Whatever is saved on an existing entry (user override)
      //   2. The machine's default item (set in Masters)
      //   3. Any active item as a last resort
      const item =
        existing?.itemId != null
          ? items.find((i) => i.id === existing.itemId)
          : machine.defaultItemId != null
          ? items.find((i) => i.id === machine.defaultItemId)
          : items.find((i) => i.status === "active");
      const expected = rateFor(item, machine);

      // Build hourly entries — use existing data when present, blanks otherwise
      const existingEntries =
        (existing?.entries as HourlyEntry[] | null) ?? [];
      const hourlyEntries: HourlyEntry[] = hours.map((hour, idx) => {
        const e = existingEntries[idx];
        return {
          hour,
          closingReading: e?.closingReading ?? null,
          actual: e?.actual ?? 0,
          expected: e?.expected ?? expected,
        };
      });

      return {
        machineId: machine.id,
        machine,
        itemId: existing?.itemId ?? item?.id ?? null,
        item,
        openingReading: existing?.openingReading ?? 0,
        entries: hourlyEntries,
        operatorName: existing?.operatorName ?? "",
        notes: existing?.notes ?? "",
        lockedHours: (existing?.lockedHours as number[] | null) ?? [],
        dirty: false,
      };
    });
}

// Recompute the `actual` values for a row given an opening reading and entries.
// actual_i = closing_i - prev, where prev = opening for i=0, else closing_{i-1}.
export function recomputeActuals(
  openingReading: number,
  entries: HourlyEntry[]
): HourlyEntry[] {
  let prev = openingReading;
  return entries.map((e) => {
    if (e.closingReading == null) {
      // unread cells keep prev frozen so the next non-null still computes correctly
      return { ...e, actual: 0 };
    }
    const actual = Math.max(0, e.closingReading - prev);
    prev = e.closingReading;
    return { ...e, actual };
  });
}
