import { useEffect, useState } from "react";
import { CheckCircle2, Plus, ShieldCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staffApi, type StaffMember, type StaffRole } from "@/lib/staff-api";

const roles: StaffRole[] = ["admin", "coordinator", "inspector", "operator", "aggregator"];

export function StaffManagement({ currentUserId }: { currentUserId: number }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "inspector" as StaffRole });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try { setStaff(await staffApi.list()); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load staff"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const addStaff = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      await staffApi.create(form);
      setForm({ name: "", email: "", phone: "", role: "inspector" });
      setMessage("Staff member approved. They can now sign in with that Google email.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add staff member"); }
    finally { setSaving(false); }
  };

  const update = async (member: StaffMember, patch: { role?: StaffRole; active?: boolean }) => {
    setMessage("");
    try { await staffApi.update(member.id, patch); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update staff member"); }
  };

  return <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
    <form onSubmit={addStaff} className="border-b border-border bg-secondary/30 p-5 xl:border-b-0 xl:border-r">
      <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h3 className="font-display text-2xl">Approve staff access</h3></div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Add their exact Google email and choose what they are allowed to do.</p>
      <label className="mt-5 block text-xs font-medium">Full name<Input className="mt-1.5" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Harleen Kaur" required /></label>
      <label className="mt-4 block text-xs font-medium">Google email<Input className="mt-1.5" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="harleen@gmail.com" required /></label>
      <label className="mt-4 block text-xs font-medium">Mobile number<Input className="mt-1.5" inputMode="numeric" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="9876543210" required /></label>
      <label className="mt-4 block text-xs font-medium">Role<select className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as StaffRole })}>{roles.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>
      <Button className="mt-5 w-full" disabled={saving}><Plus className="mr-2 h-4 w-4" />{saving ? "Approving…" : "Approve Google account"}</Button>
      {message && <p className={`mt-4 rounded-md border p-3 text-xs ${message.includes("approved") ? "border-primary/25 bg-primary/10 text-primary" : "border-destructive/25 bg-destructive/5 text-destructive"}`}>{message}</p>}
    </form>
    <div className="min-w-0 p-5">
      <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Organization access</p><h3 className="mt-2 font-display text-2xl">{staff.filter((member) => member.active).length} active staff</h3></div><p className="text-xs text-muted-foreground">Google login allowlist</p></div>
      {loading ? <div className="mt-6 h-48 animate-pulse rounded bg-secondary" /> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-3 py-3">Staff member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Access</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id} className="border-b border-border/70 last:border-0"><td className="px-3 py-4"><p className="font-medium">{member.name}{member.id === currentUserId && <span className="ml-2 text-[0.65rem] text-primary">You</span>}</p><p className="mt-1 text-xs text-muted-foreground">{member.email}<br />{member.phone}</p></td><td className="px-3 py-4"><select className="h-9 rounded-md border border-input bg-background px-2 text-xs capitalize" value={member.role} disabled={member.id === currentUserId} onChange={(event) => void update(member, { role: event.target.value as StaffRole })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></td><td className="px-3 py-4">{member.active ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[0.65rem] text-primary"><CheckCircle2 className="h-3 w-3" />Active</span> : <span className="rounded-full bg-secondary px-2 py-1 text-[0.65rem] text-muted-foreground">Disabled</span>}</td><td className="px-3 py-4 text-right"><Button size="sm" variant="outline" disabled={member.id === currentUserId} onClick={() => void update(member, { active: !member.active })}>{member.active ? <><UserX className="mr-1.5 h-3.5 w-3.5" />Disable</> : "Restore"}</Button></td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}
