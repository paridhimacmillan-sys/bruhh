'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { addShift, getShiftDefinitions, removeShift, subscribeShifts } from '@/lib/shifts';

export default function ShiftTab() {
  const [shifts, setShifts] = useState(() => getShiftDefinitions());
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('14:00');

  useEffect(() => subscribeShifts(() => setShifts([...getShiftDefinitions()])), []);

  const onAdd = async () => {
    if (!name.trim()) return;
    try {
      await addShift({ name: name.trim(), startTime, endTime });
      setName('');
      toast.success('Shift saved');
    } catch {
      toast.error('Shift could not be saved');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card-base p-4">
        <p className="text-sm font-semibold text-foreground">Shift Master</p>
        <p className="text-xs text-muted-foreground mt-0.5">Create shifts and configure their operating hours</p>
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground">Shift name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning" className="block mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" /></label>
          <label className="text-xs text-muted-foreground">Start time<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="block mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" /></label>
          <label className="text-xs text-muted-foreground">End time<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="block mt-1 px-3 py-2 text-sm border border-border rounded-md bg-card" /></label>
          <button onClick={onAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md"><Plus size={14} />Save Shift</button>
        </div>
      </div>
      <div className="card-base divide-y divide-border">
        {shifts.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground text-center">No shifts configured</p> : shifts.map((shift) => (
          <div key={shift.name} className="px-5 py-3 flex items-center justify-between">
            <div><p className="font-semibold text-sm">{shift.name}</p><p className="text-xs text-muted-foreground">{shift.startTime} - {shift.endTime}</p></div>
            <button onClick={async () => { try { await removeShift(shift.name); toast.success(`Shift "${shift.name}" removed`); } catch { toast.error('Shift could not be removed'); } }} className="p-1.5 text-danger/80"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
