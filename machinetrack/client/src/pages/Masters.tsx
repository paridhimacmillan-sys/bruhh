import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Machine, Item, Shift, Operator } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type Tab = "machines" | "items" | "shifts" | "operators";

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("machines");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Masters Management</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Set up the machines, items, shifts, and operator names that power the production grid.
      </p>

      <div className="flex gap-1 border-b mb-6">
        {(["machines", "items", "shifts", "operators"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "machines" && <MachinesTab />}
      {tab === "items" && <ItemsTab />}
      {tab === "shifts" && <ShiftsTab />}
      {tab === "operators" && <OperatorsTab />}
    </div>
  );
}

// ============================================================================
// MACHINES — the creation form pattern you asked for
// ============================================================================
function MachinesTab() {
  const { data: machines = [], isLoading } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });
  const [machineNumber, setMachineNumber] = useState("");
  const [machineType, setMachineType] = useState("CNC TURNING");
  const [targetRate, setTargetRate] = useState("60");

  const createMut = useMutation({
    mutationFn: () =>
      api<Machine>("/api/machines", {
        method: "POST",
        body: JSON.stringify({
          machineNumber: machineNumber.trim(),
          machineType: machineType.trim(),
          targetRate: parseInt(targetRate, 10),
          status: "active",
        }),
      }),
    onSuccess: () => {
      toast.success("Machine added");
      setMachineNumber("");
      setTargetRate("60");
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add machine"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/machines/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Machine removed");
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to delete"),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add machine</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!machineNumber.trim() || !machineType.trim() || !targetRate) {
              toast.error("Fill all fields");
              return;
            }
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Machine number</label>
            <input
              type="text"
              value={machineNumber}
              onChange={(e) => setMachineNumber(e.target.value)}
              placeholder="CNC 1"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <input
              type="text"
              value={machineType}
              onChange={(e) => setMachineType(e.target.value)}
              placeholder="CNC TURNING"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Target rate (pcs/hr)</label>
            <input
              type="number"
              min={1}
              value={targetRate}
              onChange={(e) => setTargetRate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus size={14} />
              {createMut.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Machine</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Target</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && machines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No machines yet. Add one above.
                </td>
              </tr>
            )}
            {machines.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2 font-mono">{m.machineNumber}</td>
                <td className="px-4 py-2">{m.machineType}</td>
                <td className="px-4 py-2 font-mono">{m.targetRate} pcs/hr</td>
                <td className="px-4 py-2 capitalize">{m.status}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${m.machineNumber}?`)) deleteMut.mutate(m.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// SHIFTS — the same creation pattern, applied to shifts
// ============================================================================
function ShiftsTab() {
  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");

  const createMut = useMutation({
    mutationFn: () =>
      api<Shift>("/api/shifts", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          startTime,
          endTime,
        }),
      }),
    onSuccess: () => {
      toast.success("Shift added");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add shift"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Shift removed");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to delete"),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add shift</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("Shift name is required");
              return;
            }
            if (startTime >= endTime) {
              toast.error("End time must be after start time");
              return;
            }
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Shift name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Start time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">End time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus size={14} />
              {createMut.isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Shift</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Start</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">End</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && shifts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No shifts yet. Add one above.
                </td>
              </tr>
            )}
            {shifts.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 font-semibold">{s.name}</td>
                <td className="px-4 py-2 font-mono">{s.startTime}</td>
                <td className="px-4 py-2 font-mono">{s.endTime}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete shift ${s.name}?`)) deleteMut.mutate(s.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// ITEMS — simpler tab (same pattern, fewer fields)
// ============================================================================
function ItemsTab() {
  const { data: items = [], isLoading } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const [itemName, setItemName] = useState("");
  const [defaultRate, setDefaultRate] = useState("60");

  const createMut = useMutation({
    mutationFn: () =>
      api<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          itemName: itemName.trim(),
          defaultRate: parseInt(defaultRate, 10),
          status: "active",
          unit: "pcs/hr",
          rates: [],
        }),
      }),
    onSuccess: () => {
      toast.success("Item added");
      setItemName("");
      setDefaultRate("60");
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/items"] }),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add item</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!itemName.trim()) return toast.error("Item name required");
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Item name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="BODY S02038"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Default rate (pcs/hr)</label>
            <input
              type="number"
              min={1}
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Item</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Rate</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            )}
            {items.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="px-4 py-2">{i.itemName}</td>
                <td className="px-4 py-2 font-mono">
                  {i.defaultRate} {i.unit}
                </td>
                <td className="px-4 py-2 capitalize">{i.status}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${i.itemName}?`)) deleteMut.mutate(i.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// OPERATORS — names assignable in the production grid
// ============================================================================
function OperatorsTab() {
  const { data: operators = [], isLoading } = useQuery<Operator[]>({
    queryKey: ["/api/operators"],
  });
  const [name, setName] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api<Operator>("/api/operators", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      }),
    onSuccess: () => {
      toast.success("Operator added");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/operators/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/operators"] }),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add operator name</h2>
        <p className="text-xs text-muted-foreground mb-3">
          These are display names for the production grid. Login accounts are managed under Users.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return toast.error("Name required");
            createMut.mutate();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Manoj"
            className="flex-1 px-3 py-2 border rounded text-sm"
          />
          <button
            type="submit"
            disabled={createMut.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            <Plus size={14} />
            Add
          </button>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading…</div>
        )}
        {!isLoading && operators.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            No operators yet.
          </div>
        )}
        {operators.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between px-4 py-2 border-t first:border-t-0"
          >
            <span>{o.name}</span>
            <button
              onClick={() => {
                if (confirm(`Delete ${o.name}?`)) deleteMut.mutate(o.id);
              }}
              className="text-destructive hover:bg-destructive/10 p-1 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
