import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { AlertThreshold } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type AlertType = "efficiency" | "gap" | "idle";
type Scope = "machine" | "shift";

const TYPE_LABELS: Record<AlertType, string> = {
  efficiency: "Efficiency below threshold",
  gap: "Production gap exceeded",
  idle: "Machine idle (no entries)",
};

const TYPE_UNITS: Record<AlertType, string> = {
  efficiency: "%",
  gap: "pcs",
  idle: "min",
};

export default function AlertsPage() {
  const { data: rules = [], isLoading } = useQuery<AlertThreshold[]>({
    queryKey: ["/api/alerts"],
  });
  const [name, setName] = useState("");
  const [type, setType] = useState<AlertType>("efficiency");
  const [threshold, setThreshold] = useState("80");
  const [scope, setScope] = useState<Scope>("machine");

  const createMut = useMutation({
    mutationFn: () =>
      api<AlertThreshold>("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type,
          threshold: parseInt(threshold, 10),
          scope,
          enabled: true,
        }),
      }),
    onSuccess: () => {
      toast.success("Alert rule added");
      setName("");
      setThreshold("80");
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add rule"),
  });

  const updateMut = useMutation({
    mutationFn: (rule: AlertThreshold) =>
      api(`/api/alerts/${rule.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !rule.enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alerts"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api(`/api/alerts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Rule removed");
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Configure thresholds. Alerts are evaluated against incoming production entries.
        </p>
      </header>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Add alert rule</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("Name is required");
              return;
            }
            const n = parseInt(threshold, 10);
            if (isNaN(n) || n < 0) {
              toast.error("Threshold must be a non-negative number");
              return;
            }
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Low efficiency"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AlertType)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="efficiency">Efficiency below</option>
              <option value="gap">Production gap above</option>
              <option value="idle">Idle minutes above</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Threshold ({TYPE_UNITS[type]})
            </label>
            <input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
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
          <div>
            <label className="block text-xs font-medium mb-1">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              <option value="machine">Per machine</option>
              <option value="shift">Per shift</option>
            </select>
          </div>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
          Configured rules
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/10">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">
                Status
              </th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Name</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Type</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Scope</th>
              <th className="text-right px-4 py-2 text-xs font-semibold uppercase">
                Threshold
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No alert rules configured. Add one above.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={() => updateMut.mutate(r)}
                      className="rounded border-input"
                    />
                    <span
                      className={`text-xs font-semibold ${
                        r.enabled ? "text-green-600" : "text-muted-foreground"
                      }`}
                    >
                      {r.enabled ? "Active" : "Disabled"}
                    </span>
                  </label>
                </td>
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {TYPE_LABELS[r.type as AlertType]}
                </td>
                <td className="px-4 py-2 capitalize text-muted-foreground">
                  {r.scope}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {r.threshold} {TYPE_UNITS[r.type as AlertType]}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${r.name}"?`)) deleteMut.mutate(r.id);
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

      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 text-sm flex gap-3">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Alert evaluation</p>
          <p className="text-xs">
            Alert rules are stored here as configuration. The notification engine that
            evaluates them against incoming entries and dispatches alerts (email, dashboard
            banner) is a separate component to be added later. For now, rules can be
            viewed and toggled here.
          </p>
        </div>
      </div>
    </div>
  );
}
