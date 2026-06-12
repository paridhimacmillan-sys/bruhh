import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { ProductionEntry, Machine, Item } from "@shared/schema";

function daysAgoYMD(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function RecentEntriesPage() {
  const [dateFrom, setDateFrom] = useState(daysAgoYMD(7));
  const [dateTo, setDateTo] = useState(daysAgoYMD(0));
  const [search, setSearch] = useState("");

  const url = `/api/entries?dateFrom=${encodeURIComponent(
    dateFrom
  )}&dateTo=${encodeURIComponent(dateTo)}`;
  const { data: entries = [], isLoading } = useQuery<ProductionEntry[]>({
    queryKey: [url],
  });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });

  const machineById = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m])),
    [machines]
  );
  const itemById = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((e) => {
      const machine = machineById[e.machineId];
      const item = e.itemId != null ? itemById[e.itemId] : undefined;
      const haystack = [
        machine?.machineNumber,
        machine?.machineType,
        item?.itemName,
        e.shift,
        e.operatorName,
        e.notes,
        e.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, machineById, itemById, search]);

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Recent Entries</h1>
        <p className="text-sm text-muted-foreground">
          Production history with filtering
        </p>
      </header>

      <div className="bg-card border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-mono"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium mb-1">Search</label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Machine, item, operator, notes…"
              className="w-full pl-8 pr-3 py-2 border rounded text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Date</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Shift</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Machine</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Item</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Operator
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                Actual
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                Target
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">Eff</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  No entries match.
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const machine = machineById[e.machineId];
              const item = e.itemId != null ? itemById[e.itemId] : undefined;
              const actual = e.totalActual ?? 0;
              const expected = e.totalExpected ?? 0;
              const eff = expected > 0 ? Math.round((actual / expected) * 100) : 0;
              return (
                <tr key={e.id} className="border-t hover:bg-muted/10">
                  <td className="px-4 py-2 font-mono">{e.date}</td>
                  <td className="px-4 py-2">{e.shift}</td>
                  <td className="px-4 py-2 font-mono">
                    {machine?.machineNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2">{item?.itemName ?? "—"}</td>
                  <td className="px-4 py-2">{e.operatorName ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">
                    {actual.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                    {expected.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-semibold ${
                      eff >= 95
                        ? "text-green-600"
                        : eff >= 80
                        ? "text-yellow-600"
                        : eff > 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {expected > 0 ? `${eff}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20 font-semibold">
                <td colSpan={5} className="px-4 py-2 text-xs uppercase text-muted-foreground">
                  {filtered.length} entries
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {filtered
                    .reduce((s, e) => s + (e.totalActual ?? 0), 0)
                    .toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {filtered
                    .reduce((s, e) => s + (e.totalExpected ?? 0), 0)
                    .toLocaleString()}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
