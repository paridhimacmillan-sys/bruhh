import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { Machine, Item, Shift, Operator, ItemRate, BreakdownReason, MachineShift } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type Tab = "machines" | "items" | "shifts" | "operators" | "reasons";

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("machines");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Masters Management</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure the machines and items that power the production grid.
      </p>

      <div className="flex gap-1 border-b mb-6">
        {(["machines", "items", "shifts", "operators", "reasons"] as Tab[]).map((t) => (
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
      {tab === "reasons" && <ReasonsTab />}
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
  // Natural sort: "CNC 2" before "CNC 10", not after.
  const sortedMachines = useMemo(
    () =>
      [...machines].sort((a, b) =>
        a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true })
      ),
    [machines]
  );
  const { data: shifts = [] } = useQuery<Shift[]>({ queryKey: ["/api/shifts"] });
  const { data: machineShifts = [] } = useQuery<MachineShift[]>({
    queryKey: ["/api/machine-shifts"],
  });
  const [machineNumber, setMachineNumber] = useState("");
  const [machineType, setMachineType] = useState("CNC TURNING");
  // Which machine row currently has its shift picker open. null = none.
  const [editingShiftsFor, setEditingShiftsFor] = useState<number | null>(null);
  // Set of selected machine ids for bulk delete
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Inline edit state: which row is being edited, and the draft values
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNumber, setEditNumber] = useState("");
  const [editType, setEditType] = useState("");

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
    mutationFn: (id: number) =>
      api<{ softDeleted: boolean }>(`/api/machines/${id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      if (result?.softDeleted) {
        toast.success("Machine marked offline (historical data preserved)");
      } else {
        toast.success("Machine deleted");
      }
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

  // Tracking mode: 'hourly' (default, full hourly grid) or 'shift_total'
  // (single opening + closing per shift, target computed from elapsed time).
  const updateTrackingModeMut = useMutation({
    mutationFn: ({ id, trackingMode }: { id: number; trackingMode: string }) =>
      api(`/api/machines/${id}`, {
        method: "PUT",
        body: JSON.stringify({ trackingMode }),
      }),
    onSuccess: () => {
      toast.success("Tracking mode updated");
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update mode"),
  });

  // Inline edit of machine number + type.
  const updateMut = useMutation({
    mutationFn: ({
      id,
      machineNumber,
      machineType,
    }: {
      id: number;
      machineNumber: string;
      machineType: string;
    }) =>
      api<Machine>(`/api/machines/${id}`, {
        method: "PUT",
        body: JSON.stringify({ machineNumber, machineType }),
      }),
    onSuccess: () => {
      toast.success("Machine updated");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  // Replace the full shift list for a machine. Pass shiftIds=[] to revert to
  // "runs in all shifts" (back-compat default).
  const setShiftsMut = useMutation({
    mutationFn: ({ machineId, shiftIds }: { machineId: number; shiftIds: number[] }) =>
      api(`/api/machine-shifts/${machineId}`, {
        method: "PUT",
        body: JSON.stringify({ shiftIds }),
      }),
    onSuccess: () => {
      toast.success("Shifts updated");
      queryClient.invalidateQueries({ queryKey: ["/api/machine-shifts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update shifts"),
  });

  // Bulk delete selected machines. Hard-deletes those without production
  // entries; soft-deletes (status=offline) those with entries.
  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ deleted: number; softDeleted: number }>("/api/machines/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.deleted > 0) parts.push(`${result.deleted} deleted`);
      if (result.softDeleted > 0)
        parts.push(`${result.softDeleted} marked offline (had data)`);
      toast.success(parts.join(", ") || "Done");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Bulk delete failed"),
  });

  // Build map: machineId → assigned shiftId Set, used to render the Shifts cell.
  const machineToShifts = new Map<number, Set<number>>();
  for (const ms of machineShifts) {
    if (!machineToShifts.has(ms.machineId)) {
      machineToShifts.set(ms.machineId, new Set());
    }
    machineToShifts.get(ms.machineId)!.add(ms.shiftId);
  }

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

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} machine{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs font-semibold border rounded hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDeleteMut.isPending}
              onClick={() => {
                const n = selected.size;
                if (
                  !confirm(
                    `Delete ${n} machine${n === 1 ? "" : "s"}? Machines with production entries will be marked offline (data preserved). Others will be permanently removed. Continue?`
                  )
                )
                  return;
                bulkDeleteMut.mutate(Array.from(selected));
              }}
              className="px-3 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-60"
            >
              {bulkDeleteMut.isPending
                ? "Deleting..."
                : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2 w-10">
                <input
                  type="checkbox"
                  checked={
                    sortedMachines.length > 0 &&
                    selected.size === sortedMachines.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(sortedMachines.map((m) => m.id)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                />
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Machine</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Status</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Mode</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Shifts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && machines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No machines yet. Add one above.
                </td>
              </tr>
            )}
            {sortedMachines.map((m) => {
              const assignedSet = machineToShifts.get(m.id) ?? new Set<number>();
              const assignedShifts = shifts.filter((s) => assignedSet.has(s.id));
              const isEditing = editingShiftsFor === m.id;
              return (
                <tr key={m.id} className="border-t align-top">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(m.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {editingId === m.id ? (
                      <input
                        type="text"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-sm font-mono"
                      />
                    ) : (
                      m.machineNumber
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === m.id ? (
                      <input
                        type="text"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className="w-36 px-2 py-1 border rounded text-sm"
                      />
                    ) : (
                      m.machineType
                    )}
                  </td>
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
                  <td className="px-4 py-2">
                    <select
                      value={(m as any).trackingMode ?? "hourly"}
                      onChange={(e) =>
                        updateTrackingModeMut.mutate({
                          id: m.id,
                          trackingMode: e.target.value,
                        })
                      }
                      disabled={updateTrackingModeMut.isPending}
                      className="px-2 py-1 border rounded text-xs font-semibold"
                      title="Hourly: log each hour. Shift total: just opening + closing per shift."
                    >
                      <option value="hourly">Hourly</option>
                      <option value="shift_total">Shift total</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => setEditingShiftsFor(m.id)}
                        className="text-xs text-left hover:underline"
                        title="Click to edit shift assignments"
                      >
                        {assignedShifts.length === 0 ? (
                          <span className="text-muted-foreground italic">
                            All shifts (default)
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {assignedShifts.map((s) => (
                              <span
                                key={s.id}
                                className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold"
                              >
                                {s.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    ) : (
                      <div className="border rounded p-2 bg-muted/20 min-w-[180px]">
                        <div className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">
                          Runs in shifts:
                        </div>
                        <div className="flex flex-col gap-1">
                          {shifts.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">
                              No shifts defined. Add some on the Shifts tab first.
                            </span>
                          )}
                          {shifts.map((s) => (
                            <label
                              key={s.id}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:bg-background rounded px-1 py-0.5"
                            >
                              <input
                                type="checkbox"
                                checked={assignedSet.has(s.id)}
                                onChange={(e) => {
                                  const next = new Set(assignedSet);
                                  if (e.target.checked) next.add(s.id);
                                  else next.delete(s.id);
                                  setShiftsMut.mutate({
                                    machineId: m.id,
                                    shiftIds: Array.from(next),
                                  });
                                }}
                              />
                              <span className="font-semibold">{s.name}</span>
                              <span className="text-muted-foreground font-mono">
                                {s.startTime}–{s.endTime}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-2 pt-2 border-t flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {assignedSet.size === 0
                              ? "Empty = runs in all shifts"
                              : `${assignedSet.size} shift(s) selected`}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingShiftsFor(null)}
                            className="text-xs text-primary font-semibold hover:underline"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === m.id ? (
                        <>
                          <button
                            onClick={() => {
                              if (!editNumber.trim() || !editType.trim()) {
                                toast.error("Both fields are required");
                                return;
                              }
                              updateMut.mutate({
                                id: m.id,
                                machineNumber: editNumber.trim(),
                                machineType: editType.trim(),
                              });
                            }}
                            disabled={updateMut.isPending}
                            className="text-green-600 hover:bg-green-50 p-1 rounded"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
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
                              setEditingId(m.id);
                              setEditNumber(m.machineNumber);
                              setEditType(m.machineType);
                            }}
                            className="text-muted-foreground hover:bg-muted p-1 rounded"
                            title="Edit machine"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${m.machineNumber}?`))
                                deleteMut.mutate(m.id);
                            }}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                            title="Delete machine"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Natural sort so "BODY 2" comes before "BODY 10"
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.itemName.localeCompare(b.itemName, undefined, { numeric: true })
      ),
    [items]
  );

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ deleted: number; softDeleted: number }>("/api/items/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (result) => {
      const parts: string[] = [];
      if (result.deleted > 0) parts.push(`${result.deleted} deleted`);
      if (result.softDeleted > 0)
        parts.push(`${result.softDeleted} marked inactive (had data)`);
      toast.success(parts.join(", ") || "Done");
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Bulk delete failed"),
  });

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
    mutationFn: (id: number) =>
      api<{ softDeleted: boolean }>(`/api/items/${id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      if (result?.softDeleted) {
        toast.success("Item marked inactive (historical entries preserved)");
      } else {
        toast.success("Item deleted");
      }
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

  const updateNameMut = useMutation({
    mutationFn: ({ id, itemName }: { id: number; itemName: string }) =>
      api(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify({ itemName }),
      }),
    onSuccess: () => {
      toast.success("Item name updated");
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} item{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs font-semibold border rounded hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDeleteMut.isPending}
              onClick={() => {
                const n = selected.size;
                if (
                  !confirm(
                    `Delete ${n} item${n === 1 ? "" : "s"}? Items with production entries will be marked inactive (data preserved). Others will be permanently removed. Continue?`
                  )
                )
                  return;
                bulkDeleteMut.mutate(Array.from(selected));
              }}
              className="px-3 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-60"
            >
              {bulkDeleteMut.isPending ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      {sortedItems.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected.size === sortedItems.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelected(new Set(sortedItems.map((i) => i.id)));
              } else {
                setSelected(new Set());
              }
            }}
          />
          <span className="text-xs text-muted-foreground">Select all</span>
        </div>
      )}

      {sortedItems.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          machines={machines}
          selected={selected.has(item.id)}
          onToggleSelected={(checked) => {
            const next = new Set(selected);
            if (checked) next.add(item.id);
            else next.delete(item.id);
            setSelected(next);
          }}
          onUpdateName={(name) => updateNameMut.mutate({ id: item.id, itemName: name })}
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
  selected,
  onToggleSelected,
  onUpdateName,
  onUpdateRates,
  onDelete,
}: {
  item: Item;
  machines: Machine[];
  selected: boolean;
  onToggleSelected: (checked: boolean) => void;
  onUpdateName: (name: string) => void;
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

  // Inline edit for item name itself
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(item.itemName);

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
    <div className={`bg-card border rounded-lg p-4 ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelected(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="px-2 py-1 border rounded text-sm font-semibold"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (!nameValue.trim()) {
                      toast.error("Name required");
                      return;
                    }
                    onUpdateName(nameValue.trim());
                    setEditingName(false);
                  }}
                  className="text-green-600 hover:bg-green-50 p-1 rounded"
                  title="Save"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    setNameValue(item.itemName);
                    setEditingName(false);
                  }}
                  className="text-muted-foreground hover:bg-muted p-1 rounded"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-semibold">{item.itemName}</p>
                <button
                  onClick={() => {
                    setNameValue(item.itemName);
                    setEditingName(true);
                  }}
                  className="text-muted-foreground hover:bg-muted p-1 rounded"
                  title="Edit name"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Runs on {rates.length} machine{rates.length === 1 ? "" : "s"}
            </p>
          </div>
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

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

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; startTime: string; endTime: string };
    }) =>
      api<Shift>(`/api/shifts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Shift updated");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/shifts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Shift removed");
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ deleted: number }>("/api/shifts/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} shift(s) deleted`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Bulk delete failed"),
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} shift{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs font-semibold border rounded hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDeleteMut.isPending}
              onClick={() => {
                const n = selected.size;
                if (!confirm(`Delete ${n} shift${n === 1 ? "" : "s"}?`)) return;
                bulkDeleteMut.mutate(Array.from(selected));
              }}
              className="px-3 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-60"
            >
              {bulkDeleteMut.isPending ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2 w-10">
                <input
                  type="checkbox"
                  checked={shifts.length > 0 && selected.size === shifts.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(shifts.map((s) => s.id)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Shift</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Start</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">End</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && shifts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No shifts yet.
                </td>
              </tr>
            )}
            {shifts.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-sm"
                      />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {isEditing ? (
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="px-2 py-1 border rounded text-sm font-mono"
                      />
                    ) : (
                      s.startTime
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {isEditing ? (
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="px-2 py-1 border rounded text-sm font-mono"
                      />
                    ) : (
                      s.endTime
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              if (!editName.trim()) {
                                toast.error("Name required");
                                return;
                              }
                              updateMut.mutate({
                                id: s.id,
                                data: {
                                  name: editName.trim(),
                                  startTime: editStart,
                                  endTime: editEnd,
                                },
                              });
                            }}
                            disabled={updateMut.isPending}
                            className="text-green-600 hover:bg-green-50 p-1 rounded"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
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
                              setEditingId(s.id);
                              setEditName(s.name);
                              setEditStart(s.startTime);
                              setEditEnd(s.endTime);
                            }}
                            className="text-muted-foreground hover:bg-muted p-1 rounded"
                            title="Edit shift"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete shift ${s.name}?`))
                                deleteMut.mutate(s.id);
                            }}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api<Operator>(`/api/operators/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      toast.success("Operator updated");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/operators/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/operators"] }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ deleted: number }>("/api/operators/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} operator(s) deleted`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/operators"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Bulk delete failed"),
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} operator{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs font-semibold border rounded hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDeleteMut.isPending}
              onClick={() => {
                const n = selected.size;
                if (!confirm(`Delete ${n} operator${n === 1 ? "" : "s"}?`)) return;
                bulkDeleteMut.mutate(Array.from(selected));
              }}
              className="px-3 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-60"
            >
              {bulkDeleteMut.isPending ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        {isLoading && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">Loading...</div>
        )}
        {!isLoading && operators.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            No operators yet.
          </div>
        )}
        {operators.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b">
            <input
              type="checkbox"
              checked={selected.size === operators.length}
              onChange={(e) => {
                if (e.target.checked) setSelected(new Set(operators.map((o) => o.id)));
                else setSelected(new Set());
              }}
            />
            <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
              Select all
            </span>
          </div>
        )}
        {operators.map((o) => {
          const isEditing = editingId === o.id;
          return (
            <div
              key={o.id}
              className="flex items-center justify-between px-4 py-2 border-t first:border-t-0"
            >
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o.id);
                    else next.delete(o.id);
                    setSelected(next);
                  }}
                />
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 border rounded text-sm flex-1 max-w-xs"
                    autoFocus
                  />
                ) : (
                  <span>{o.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        if (!editName.trim()) {
                          toast.error("Name required");
                          return;
                        }
                        updateMut.mutate({ id: o.id, name: editName.trim() });
                      }}
                      disabled={updateMut.isPending}
                      className="text-green-600 hover:bg-green-50 p-1 rounded"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
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
                        setEditingId(o.id);
                        setEditName(o.name);
                      }}
                      className="text-muted-foreground hover:bg-muted p-1 rounded"
                      title="Edit operator"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${o.name}?`)) deleteMut.mutate(o.id);
                      }}
                      className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// REASONS — breakdown reason codes operators pick when a row underperforms
// ============================================================================
function ReasonsTab() {
  const { data: reasons = [], isLoading } = useQuery<BreakdownReason[]>({
    queryKey: ["/api/reasons"],
  });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const createMut = useMutation({
    mutationFn: () =>
      api<BreakdownReason>("/api/reasons", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || "general",
          status: "active",
        }),
      }),
    onSuccess: () => {
      toast.success("Reason added");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/reasons"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add"),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/api/reasons/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/reasons"] }),
    onError: (err: any) => toast.error(err.message ?? "Update failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; category: string };
    }) =>
      api<BreakdownReason>(`/api/reasons/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Reason updated");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/reasons"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/reasons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Reason removed");
      queryClient.invalidateQueries({ queryKey: ["/api/reasons"] });
    },
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: number[]) =>
      api<{ deleted: number }>("/api/reasons/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} reason(s) deleted`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/reasons"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Bulk delete failed"),
  });

  const seedMut = useMutation({
    mutationFn: () => api<{ seeded: number }>("/api/reasons/seed", { method: "POST" }),
    onSuccess: (data) => {
      toast.success(`Seeded ${data.seeded} reasons`);
      queryClient.invalidateQueries({ queryKey: ["/api/reasons"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Seed failed"),
  });

  return (
    <section className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-semibold">Add breakdown reason</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operators pick from this list when an hour falls below target efficiency.
            </p>
          </div>
          {reasons.length === 0 && (
            <button
              type="button"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
              className="px-3 py-1.5 text-xs font-semibold border rounded hover:bg-muted disabled:opacity-60"
            >
              {seedMut.isPending ? "Seeding..." : "Seed defaults"}
            </button>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return toast.error("Reason name required");
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Reason name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Insert Change"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="general">General</option>
              <option value="machine">Machine</option>
              <option value="operator">Operator</option>
              <option value="material">Material</option>
              <option value="setup">Setup</option>
              <option value="utility">Utility (power/air)</option>
            </select>
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

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} reason{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="px-3 py-1 text-xs font-semibold border rounded hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDeleteMut.isPending}
              onClick={() => {
                const n = selected.size;
                if (!confirm(`Delete ${n} reason${n === 1 ? "" : "s"}?`)) return;
                bulkDeleteMut.mutate(Array.from(selected));
              }}
              className="px-3 py-1 text-xs font-semibold bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 disabled:opacity-60"
            >
              {bulkDeleteMut.isPending ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2 w-10">
                <input
                  type="checkbox"
                  checked={reasons.length > 0 && selected.size === reasons.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(reasons.map((r) => r.id)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Reason</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Category</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && reasons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No reasons yet. Add some above, or click "Seed defaults" for the standard list.
                </td>
              </tr>
            )}
            {reasons.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize text-muted-foreground">
                    {isEditing ? (
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="general">General</option>
                        <option value="machine">Machine</option>
                        <option value="operator">Operator</option>
                        <option value="material">Material</option>
                        <option value="setup">Setup</option>
                        <option value="utility">Utility</option>
                      </select>
                    ) : (
                      r.category
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={r.status}
                      onChange={(e) =>
                        updateStatusMut.mutate({ id: r.id, status: e.target.value })
                      }
                      className={`px-2 py-1 border rounded text-xs capitalize font-semibold ${
                        r.status === "active"
                          ? "text-green-600 border-green-200 bg-green-50"
                          : "text-muted-foreground border-input"
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              if (!editName.trim()) {
                                toast.error("Name required");
                                return;
                              }
                              updateMut.mutate({
                                id: r.id,
                                data: {
                                  name: editName.trim(),
                                  category: editCategory,
                                },
                              });
                            }}
                            disabled={updateMut.isPending}
                            className="text-green-600 hover:bg-green-50 p-1 rounded"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
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
                              setEditingId(r.id);
                              setEditName(r.name);
                              setEditCategory(r.category ?? "general");
                            }}
                            className="text-muted-foreground hover:bg-muted p-1 rounded"
                            title="Edit reason"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${r.name}"?`))
                                deleteMut.mutate(r.id);
                            }}
                            className="text-destructive hover:bg-destructive/10 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
