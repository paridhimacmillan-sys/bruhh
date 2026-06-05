'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Trash2, KeyRound, Users, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { useAccess } from '@/lib/useAccess';

interface OperatorUser {
  username: string;
  full_name: string;
  created_at: string;
}

export default function UsersClient() {
  const { access, loading } = useAccess();
  const router = useRouter();

  // Redirect non-admins away
  useEffect(() => {
    if (!loading && access.authenticated && !access.isAdmin) {
      router.replace('/production-entry');
    }
  }, [loading, access, router]);

  const [users, setUsers] = useState<OperatorUser[]>([]);
  const [fetching, setFetching] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addName, setAddName] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addShowPw, setAddShowPw] = useState(false);
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  // Set password modal state
  const [pwTarget, setPwTarget] = useState<OperatorUser | null>(null);
  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [settingPw, setSettingPw] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<OperatorUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast.error('Could not load users');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const validateAdd = () => {
    const errs: Record<string, string> = {};
    if (!addUsername.trim()) errs.username = 'Username is required';
    else if (!/^[a-z0-9_]+$/i.test(addUsername.trim())) errs.username = 'Only letters, numbers, underscores allowed';
    if (!addPassword) errs.password = 'Password is required';
    else if (addPassword.length < 4) errs.password = 'Minimum 4 characters';
    return errs;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateAdd();
    if (Object.keys(errs).length) { setAddErrors(errs); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: addUsername.trim(), name: addName.trim() || addUsername.trim(), password: addPassword }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create user'); return; }
      toast.success(`User "@${addUsername.trim()}" created`);
      setAddUsername(''); setAddName(''); setAddPassword(''); setAddErrors({});
      setShowAddForm(false);
      loadUsers();
    } finally {
      setAdding(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    if (newPw.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    setSettingPw(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pwTarget.username, password: newPw }),
      });
      if (!res.ok) { toast.error('Failed to update password'); return; }
      toast.success(`Password updated for @${pwTarget.username}`);
      setPwTarget(null); setNewPw('');
    } finally {
      setSettingPw(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: deleteTarget.username }),
      });
      if (!res.ok) { toast.error('Failed to delete user'); return; }
      toast.success(`@${deleteTarget.username} removed`);
      setDeleteTarget(null);
      loadUsers();
    } finally {
      setDeleting(false);
    }
  };

  if (loading || (!access.authenticated && !loading)) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage operator accounts. Operators can only view Production Entry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadUsers} className="p-2 rounded-md hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={() => { setShowAddForm(true); setAddErrors({}); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            <UserPlus size={14} />
            Add User
          </button>
        </div>
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="card-base p-5 space-y-4 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">New Operator Account</h3>
            <button onClick={() => { setShowAddForm(false); setAddErrors({}); }} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Username <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={addUsername}
                onChange={(e) => { setAddUsername(e.target.value); setAddErrors((p) => ({ ...p, username: '' })); }}
                placeholder="e.g. raj_operator"
                autoComplete="off"
                className={`w-full px-3 py-2 text-sm border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring ${addErrors.username ? 'border-danger' : 'border-border'}`}
              />
              {addErrors.username && <p className="text-xs text-danger mt-1">{addErrors.username}</p>}
              <p className="text-xs text-muted-foreground mt-1">This is what they type to log in</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Raj Kumar"
                autoComplete="off"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Password <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type={addShowPw ? 'text' : 'password'}
                  value={addPassword}
                  onChange={(e) => { setAddPassword(e.target.value); setAddErrors((p) => ({ ...p, password: '' })); }}
                  placeholder="Min. 4 characters"
                  autoComplete="new-password"
                  className={`w-full px-3 py-2 pr-9 text-sm border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring ${addErrors.password ? 'border-danger' : 'border-border'}`}
                />
                <button type="button" onClick={() => setAddShowPw(!addShowPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {addShowPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {addErrors.password && <p className="text-xs text-danger mt-1">{addErrors.password}</p>}
            </div>
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={adding}
                className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {adding ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddErrors({}); }} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="card-base overflow-hidden">
        {fetching ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center">
            <Users size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No operator accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add User" to create login credentials for shop floor operators.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.username} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(u.full_name || u.username)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">@{u.username}</p>
                        {u.full_name && u.full_name !== u.username && (
                          <p className="text-xs text-muted-foreground">{u.full_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground">
                      Operator
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setPwTarget(u); setNewPw(''); setShowNewPw(false); }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Set password"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="p-1.5 rounded hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Set password modal */}
      {pwTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setPwTarget(null)}>
          <div className="w-full max-w-sm card-base p-6 rounded-xl shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Set Password</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Set a new password for <strong>@{pwTarget.username}</strong></p>
              </div>
              <button onClick={() => setPwTarget(null)} className="p-1 hover:bg-muted rounded text-muted-foreground">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min. 4 characters"
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={4}
                    className="w-full px-3 py-2 pr-9 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={settingPw}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {settingPw ? 'Saving…' : 'Set Password'}
                </button>
                <button type="button" onClick={() => setPwTarget(null)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm card-base p-6 rounded-xl shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Remove User?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                This will permanently delete <strong>@{deleteTarget.username}</strong>. They will no longer be able to sign in.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-semibold bg-danger text-white rounded-md hover:bg-danger/90 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
