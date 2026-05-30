'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { addShift, getShifts, removeShift, subscribeShifts } from '@/lib/shifts';

export default function ShiftTab() {
  const [shifts, setShifts] = useState<string[]>(() => getShifts());
  const [newShift, setNewShift] = useState('');

  useEffect(() => {
    const unsub = subscribeShifts(() => setShifts(getShifts()));
    return unsub;
  }, []);

  const onAdd = () => {
    const val = newShift.trim();
    if (!val) return;
    if (shifts.some((s) => s.toLowerCase() === val.toLowerCase())) {
      toast.error('Shift already exists');
      return;
    }
    addShift(val);
    setNewShift('');
    toast.success(`Shift "${val}" created`);
  };

  const onRemove = (name: string) => {
    removeShift(name);
    toast.success(`Shift "${name}" removed`);
  };

  return (
    <div className="space-y-4">
      <div className="card-base p-4">
        <p className="text-sm font-semibold text-foreground">Shift Master</p>
        <p className="text-xs text-muted-foreground mt-0.5">Admin can create any shift names used in production entry</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newShift}
            onChange={(e) => setNewShift(e.target.value)}
            placeholder="e.g. Morning, Shift A, Night"
            className="px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring w-72"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd();
            }}
          />
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add Shift
          </button>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configured Shifts</p>
        </div>
        <div className="divide-y divide-border">
          {shifts.map((s) => (
            <div key={s} className="px-5 py-3 flex items-center justify-between">
              <span className="font-semibold text-foreground text-sm">{s}</span>
              <button
                onClick={() => onRemove(s)}
                className="p-1.5 rounded-md hover:bg-danger/10 text-danger/80 transition-colors"
                title="Remove shift"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

