import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { Machine, Item, Shift, Operator, ItemRate } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type Tab = "machines" | "items" | "shifts" | "operators";

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("machines");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Masters Management</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure the machines and items that power the production grid.
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
// MACHINES — just identity. Rates configured in Items tab.
// ============================================================================
function MachinesTab() {
  const { data: machines = [], isLoading } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });
  const [machineNumber, setMachineNumber] = useState("");
  const [machineType, setMachineType] = useState("CNC TURNING");

  const createMut = useMutation({
    mutationFn: () =>
      api<Machine>("/api/machines", {
        method: "POST",
        body: JSON.stringify({
          machineNumber: machineNumber.trim(),
          machineType: machineType.trim(),
          status: "active",
        }),
      }),
    onSuccess: () => {
      toast.success("Machine added");
      setMachineNumber("");
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

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/api/machines/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update status"),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-1">Add machine</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Rates are configured per machine in the Items tab.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!machineNumber.trim() || !machineType.trim()) {
              toast.error("Fill all fields");
              return;
            }
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
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
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus size={14} />
              {createMut.isPending ? "Adding..." : "Add"}
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
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && machines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No machines yet. Add one above.
                </td>
              </tr>
            )}
            {machines.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2 font-mono">{m.machineNumber}</td>
                <td className="px-4 py-2">{m.machineType}</td>
                <td className="px-4 py-2">
                  <select
                    value={m.status}
                    onChange={(e) =>
                      updateStatusMut.mutate({ id: m.id, status: e.target.value })
                    }
                    disabled={updateStatusMut.isPending}
                    className={`px-2 py-1 border rounded text-xs capitalize font-semibold ${
                      m.status === "active"
                        ? "text-green-600 border-green-200 bg-green-50"
                        : m.status === "maintenance"
                        ? "text-yellow-700 border-yellow-200 bg-yellow-50"
                        : "text-muted-foreground border-input"
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="offline">Offline</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${m.machineNumber}?`)) deleteMut.mutate(m.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    title="Delete machine"
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
// ITEMS — each item is a card with a list of (machine, rate) assignments.
// ============================================================================
function ItemsTab() {
  const { data: items = [], isLoading } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const [itemName, setItemName] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api<Item>("/api/items", {
        method: "POST",
        body: JSON.stringify({
          itemName: itemName.trim(),
          status: "active",
          rates: [],
        }),
      }),
    onSuccess: () => {
      toast.success("Item added");
      setItemName("");
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Item removed");
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
  });

  // Mutation to replace the entire rates array for an item.
  const updateRatesMut = useMutation({
    mutationFn: ({ id, rates }: { id: number; rates: ItemRate[] }) =>
      api(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ rates }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  return (
    <section className="space-y-4">
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
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Item name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="BODY S02038"
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

      {isLoading && (
        <div className="bg-card border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="bg-card border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No items yet. Add one above.
        </div>
      )}

      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          machines={machines}
          onUpdateRates={(rates) => updateRatesMut.mutate({ id: item.id, rates })}
          onDelete={() => {
            if (confirm(`Delete ${item.itemName}?`)) deleteMut.mutate(item.id);
          }}
        />
      ))}
    </section>
  );
}

// One item, with inline machine-rate assignment editing.
function ItemCard({
  item,
  machines,
  onUpdateRates,
  onDelete,
}: {
  item: Item;
  machines: Machine[];
  onUpdateRates: (rates: ItemRate[]) => void;
  onDelete: () => void;
}) {
  const rates = ((item.rates as ItemRate[] | null) ?? []).slice();

  // Form state for adding a new (machine, rate) assignment
  const [newMachineId, setNewMachineId] = useState("");
  const [newRate, setNewRate] = useState("");

  // Inline edit for an existing rate
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState("");

  // Machines NOT already assigned to this item — eligible for the add dropdown
  const availableMachines = machines.filter(
    (m) => m.status === "active" && !rates.some((r) => r.machineId === m.id)
  );

  const machineLabel = (id: number) =>
    machines.find((m) => m.id === id)?.machineNumber ?? `Machine #${id}`;

  const handleAdd = () => {
    if (!newMachineId) {
      toast.error("Pick a machine");
      return;
    }
    const r = parseInt(newRate, 10);
    if (isNaN(r) || r <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }
    const updated = [...rates, { machineId: parseInt(newMachineId, 10), rate: r }];
    onUpdateRates(updated);
    setNewMachineId("");
    setNewRate("");
  };

  const handleRemove = (machineId: number) => {
    const updated = rates.filter((r) => r.machineId !== machineId);
    onUpdateRates(updated);
  };

  const handleCommitEdit = (machineId: number) => {
    const r = parseInt(editingRateValue, 10);
    if (isNaN(r) || r <= 0) {
      toast.error("Rate must be a positive number");
      return;
    }
    const updated = rates.map((row) =>
      row.machineId === machineId ? { ...row, rate: r } : row
    );
    onUpdateRates(updated);
    setEditingMachineId(null);
    setEditingRateValue("");
  };

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold">{item.itemName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Runs on {rates.length} machine{rates.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 p-1.5 rounded"
          title="Delete item"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wider">
          Machine assignments
        </p>

        {rates.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            Not assigned to any machine yet.
          </p>
        )}

        {rates.map((r) => {
          const isEditing = editingMachineId === r.machineId;
          return (
            <div
              key={r.machineId}
              className="flex items-center justify-between border-b last:border-b-0 py-2 text-sm"
            >
              <span className="font-mono">{machineLabel(r.machineId)}</span>
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <input
                    type="number"
                    min={1}
                    value={editingRateValue}
                    autoFocus
                    onChange={(e) => setEditingRateValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitEdit(r.machineId);
                      if (e.key === "Escape") {
                        setEditingMachineId(null);
                        setEditingRateValue("");
                      }
                    }}
                    className="w-24 px-2 py-1 border rounded text-sm font-mono text-right"
                  />
                ) : (
                  <span className="font-mono">{r.rate} pcs/hr</span>
                )}
                <div className="inline-flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleCommitEdit(r.machineId)}
                        className="text-green-600 hover:bg-green-50 p-1 rounded"
                        title="Save"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingMachineId(null);
                          setEditingRateValue("");
                        }}
                        className="text-muted-foreground hover:bg-muted p-1 rounded"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingMachineId(r.machineId);
                          setEditingRateValue(String(r.rate));
                        }}
                        className="text-muted-foreground hover:bg-muted p-1 rounded"
                        title="Edit rate"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleRemove(r.machineId)}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive p-1 rounded"
                        title="Remove from machine"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {availableMachines.length > 0 && (
          <div className="flex items-end gap-2 mt-3 pt-3 border-t border-dashed">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Machine</label>
              <select
                value={newMachineId}
                onChange={(e) => setNewMachineId(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="">-- pick a machine --</option>
                {availableMachines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machineNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium mb-1">Rate (pcs/hr)</label>
              <input
                type="number"
                min={1}
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="60"
                className="w-full px-2 py-1.5 border rounded text-sm font-mono"
              />
            </div>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-semibold flex items-center gap-1"
            >
              <Plus size={13} />
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SHIFTS
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
        body: JSON.stringify({ name: name.trim(), startTime, endTime }),
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
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add shift</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return toast.error("Shift name is required");
            if (startTime >= endTime) return toast.error("End time must be after start time");
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
              Add
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
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && shifts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No shifts yet.
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
// OPERATORS
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
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading...</div>
        )}
        {!isLoading && operators.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            No operators yet.
          </div>
        )}
        {operators.map((o) => (
          <div key={o.id} className="flex items-center justify-between px-4 py-2 border-t first:border-t-0">
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
