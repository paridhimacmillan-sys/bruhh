'use client';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface OperatorAccount {
  username: string;
  full_name: string;
  created_at: string;
}

export default function OperatorAccountsTab() {
  const [accounts, setAccounts] = useState<OperatorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load');
      setAccounts(await res.json());
    } catch {
      toast.error('Could not load operator accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = 'Username is required';
    else if (!/^[a-z0-9_]+$/i.test(form.username.trim())) errs.username = 'Only letters, numbers, underscores';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 4) errs.password = 'Minimum 4 characters';
    return errs;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.username.trim(), name: form.name.trim() || form.username.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create account'); return; }
      toast.success(`Operator account "${form.username}" created`);
      setForm({ username: '', name: '', password: '' });
      setErrors({});
      setShowForm(false);
      loadAccounts();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete account for "${username}"? They will no longer be able to log in.`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) { toast.error('Failed to delete account'); return; }
      toast.success(`Account "${username}" deleted`);
      loadAccounts();
    } catch {
      toast.error('Failed to delete account');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Operator Login Accounts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create username &amp; password accounts for operators. They can only view the Production Entry page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAccounts} className="p-2 rounded-md hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setErrors({}); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={14} />
            Add Operator
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card-base p-5 space-y-4 border-primary/30 bg-primary/5">
          <h3 className="text-sm font-semibold text-foreground">New Operator Account</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Username <span className="text-danger">*</span></label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); setErrors((err) => ({ ...err, username: '' })); }}
                placeholder="e.g. raj_operator"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
              />
              {errors.username && <p className="text-xs text-danger mt-1">{errors.username}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Raj Kumar"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Password <span className="text-danger">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors((err) => ({ ...err, password: '' })); }}
                  placeholder="Min. 4 characters"
                  className="w-full px-3 py-2 pr-9 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-danger mt-1">{errors.password}</p>}
            </div>
            <div className="sm:col-span-3 flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Account'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setErrors({}); }} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts table */}
      <div className="card-base overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center">
            <UserPlus size={28} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No operator accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Add Operator" to create login credentials for shop floor operators.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.username} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{acc.username}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{acc.full_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(acc.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">Operator</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(acc.username)}
                      className="p-1.5 rounded hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                      title="Delete account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
