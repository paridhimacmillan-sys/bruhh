'use client';
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { addOperator, getOperators, removeOperator, subscribeOperators } from '@/lib/operators';

export default function OperatorTab() {
  const [operators, setOperators] = useState(() => getOperators());
  const [name, setName] = useState('');
  useEffect(() => subscribeOperators(() => setOperators([...getOperators()])), []);

  return <div className="space-y-4">
    <div className="card-base p-4">
      <p className="text-sm font-semibold">Shift Operator Master</p>
      <p className="text-xs text-muted-foreground mt-0.5">Create operators available during production entry</p>
      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Operator name" className="px-3 py-2 text-sm border border-border rounded-md bg-card w-72" />
        <button onClick={async () => { if (!name.trim()) return; try { await addOperator(name.trim()); setName(''); toast.success('Operator created'); } catch { toast.error('Operator could not be saved'); } }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md"><Plus size={14} />Add Operator</button>
      </div>
    </div>
    <div className="card-base divide-y divide-border">
      {operators.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground text-center">No operators configured</p> : operators.map((operator) => (
        <div key={operator} className="px-5 py-3 flex items-center justify-between"><span className="font-semibold text-sm">{operator}</span><button onClick={async () => { try { await removeOperator(operator); toast.success('Operator removed'); } catch { toast.error('Operator could not be removed'); } }} className="p-1.5 text-danger/80"><Trash2 size={14} /></button></div>
      ))}
    </div>
  </div>;
}
