import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { User } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/operators-account"],
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      api("/api/operators-account", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      }),
    onSuccess: () => {
      toast.success("Operator account created");
      setUsername("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/operators-account"] });
    },
    onError: (err: any) => toast.error(err.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      api(`/api/operators-account/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["/api/operators-account"] });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Operator Accounts</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Create login accounts for shop-floor operators. They sign in with username + password.
      </p>

      <div className="bg-card border rounded-lg p-4 mb-6">
        <h2 className="font-semibold mb-3">Create account</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!username.trim() || !password) {
              toast.error("Username and password required");
              return;
            }
            createMut.mutate();
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div>
            <label className="block text-xs font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="manoj"
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              Create
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Username</th>
              <th className="text-left px-4 py-2 text-xs font-semibold uppercase">Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No operator accounts yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-mono">{u.username}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${u.username}?`)) deleteMut.mutate(u.id);
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
    </div>
  );
}
