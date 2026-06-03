'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { toast } from 'sonner';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { Machine, MachineStatus } from '@/lib/mockData';
import { getMachines, getItems, addMachine, updateMachine, deleteMachine, subscribe } from '@/lib/store';
import MachineForm from './MachineForm';
import ImportModal, { ImportRow, ImportError } from './ImportModal';
import { useAccess } from '@/lib/useAccess';

type SortKey = 'machineNumber' | 'machineType' | 'status';

export default function MachineTab() {
  const { access } = useAccess();
  const [machines, setMachines] = useState<Machine[]>(() => getMachines());
  const [items, setItems] = useState(() => getItems());
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('machineNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [addOpen, setAddOpen] = useState(false);
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MachineStatus>('all');
  const [importOpen, setImportOpen] = useState(false);

  const MACHINE_TEMPLATE_HEADERS = ['machineNumber', 'machineType', 'expectedPerHour', 'status', 'operatorName'];
  const MACHINE_TEMPLATE_SAMPLE = [
    ['MCH-001', 'Machine Type A', '75', 'active', 'John Doe'] ,
    ['MCH-002', 'Machine Type B', '120', 'idle', ''] ,
  ];

  const validateMachineRow = (row: ImportRow, index: number): ImportError[] => {
    const errs: ImportError[] = [];
    if (!row['machinenumber']?.trim()) errs.push({ row: index, field: 'machineNumber', message: 'Required' });
    if (!row['machinetype']?.trim()) errs.push({ row: index, field: 'machineType', message: 'Required' });
    const expected = Number(row['expectedperhour']);
    if (!row['expectedperhour'] || isNaN(expected) || expected <= 0) {
      errs.push({ row: index, field: 'expectedPerHour', message: 'Must be a number greater than 0' });
    }
    const validStatuses = ['active', 'idle', 'maintenance', 'offline'];
    if (row['status'] && !validStatuses.includes(row['status'].toLowerCase())) {
      errs.push({ row: index, field: 'status', message: `Must be one of: ${validStatuses.join(', ')}` });
    }
    return errs;
  };

  const handleMachineImport = async (rows: ImportRow[]) => {
    try {
      await Promise.all(rows.map((row) => {
      const newM: Machine = {
        id: `machine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        machineNumber: row['machinenumber'] ?? '',
        machineType: row['machinetype'] ?? '',
        expectedPerHour: Number(row['expectedperhour']),
        status: (row['status']?.toLowerCase() as MachineStatus) || 'active',
        operatorName: row['operatorname']?.trim() || null,
        currentItem: null,
        lastEntryTime: null,
        assignedItems: [],
        createdAt: new Date().toISOString().split('T')[0],
      };
        return addMachine(newM);
      }));
      toast.success(`${rows.length} machine${rows.length !== 1 ? 's' : ''} imported successfully`);
    } catch {
      toast.error('Machines could not be imported');
    }
  };

  useEffect(() => {
    const unsub = subscribe(() => {
      setMachines(getMachines());
      setItems(getItems());
    });
    return unsub;
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-muted-foreground opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  const filtered = machines
    .filter((m) => {
      const q = search.toLowerCase();
      return (
        (statusFilter === 'all' || m.status === statusFilter) &&
        (m.machineNumber.toLowerCase().includes(q) ||
          m.machineType.toLowerCase().includes(q) ||
          (m.operatorName?.toLowerCase().includes(q) ?? false))
      );
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

  const handleSave = async (data: Partial<Machine>) => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    try {
      if (editMachine) {
        await updateMachine(editMachine.id, data);
        toast.success(`${data.machineNumber} updated successfully`);
      } else {
        const newM: Machine = {
          id: `machine-${Date.now()}`,
          machineType: data.machineType ?? '',
          machineNumber: data.machineNumber ?? '',
          expectedPerHour: Number(data.expectedPerHour),
          status: (data.status as MachineStatus) ?? 'active',
          currentItem: null,
          operatorName: data.operatorName ?? null,
          lastEntryTime: null,
          assignedItems: data.assignedItems ?? [],
          createdAt: new Date().toISOString().split('T')[0],
        };
        await addMachine(newM);
        toast.success(`${newM.machineNumber} added to Machine Master`);
      }
    } catch {
      toast.error('Machine could not be saved');
      return;
    }
    setAddOpen(false);
    setEditMachine(null);
  };

  const handleDelete = async () => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    if (!deleteId) return;
    const m = machines.find((x) => x.id === deleteId);
    try {
      await deleteMachine(deleteId);
      setDeleteId(null);
      toast.success(`${m?.machineNumber ?? 'Machine'} removed from master`);
    } catch {
      toast.error('Machine could not be removed');
    }
  };

  const STATUS_OPTIONS: Array<'all' | MachineStatus> = ['all', 'active', 'idle', 'maintenance', 'offline'];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search machines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring w-56"
            />
          </div>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={`status-filter-${s}`}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-primary text-white' :'bg-muted text-muted-foreground hover:bg-secondary'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!access.isAdmin}
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-border bg-card text-foreground rounded-md hover:bg-muted transition-colors active:scale-95"
          >
            <Upload size={15} />
            Import
          </button>
          <button
            disabled={!access.isAdmin}
            onClick={() => { setEditMachine(null); setAddOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95"
          >
            <Plus size={15} />
            Add Machine
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {[
                  { key: 'machineNumber', label: 'Machine No.' },
                  { key: 'machineType', label: 'Type' },
                  { key: 'status', label: 'Status' },
                ].map((col) => (
                  <th
                    key={`th-machine-${col.key}`}
                    className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none hover:text-foreground"
                    onClick={() => toggleSort(col.key as SortKey)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key as SortKey} />
                    </span>
                  </th>
                ))}
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operator</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target/hr</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Items</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Entry</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-muted-foreground">No machines match your search</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting the filters or add a new machine</p>
                  </td>
                </tr>
              ) : (
                filtered.map((machine, idx) => {
                  const assignedNames = machine.assignedItems
                    .map((id) => items.find((i) => i.id === id)?.itemName ?? id)
                    .slice(0, 2);
                  const extraCount = machine.assignedItems.length - 2;
                  return (
                    <tr
                      key={machine.id}
                      className={`border-b border-border hover:bg-muted/30 transition-colors group ${
                        idx % 2 === 0 ? '' : 'bg-muted/10'
                      }`}
                    >
                      <td className="px-5 py-3 font-semibold font-mono-nums text-foreground">
                        {machine.machineNumber}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{machine.machineType}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={machine.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {machine.operatorName ?? <span className="italic text-muted-foreground/60">Unassigned</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-mono-nums text-xs text-foreground">
                        {machine.expectedPerHour}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {assignedNames.map((name) => (
                            <span
                              key={`assigned-${machine.id}-${name}`}
                              className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground truncate max-w-[100px]"
                              title={name}
                            >
                              {name.split(' — ')[0]}
                            </span>
                          ))}
                          {extraCount > 0 && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                              +{extraCount}
                            </span>
                          )}
                          {machine.assignedItems.length === 0 && (
                            <span className="text-xs italic text-muted-foreground/60">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono-nums text-xs text-muted-foreground">
                        {machine.lastEntryTime ? `${machine.lastEntryTime} AM` : <span className="text-danger/80">No entry</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground font-mono-nums">{machine.createdAt}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            disabled={!access.isAdmin}
                            onClick={() => { setEditMachine(machine); setAddOpen(true); }}
                            className="p-1.5 hover:bg-muted rounded-md transition-colors"
                            title="Edit machine"
                          >
                            <Edit2 size={14} className="text-muted-foreground" />
                          </button>
                          <button
                            disabled={!access.isAdmin}
                            onClick={() => setDeleteId(machine.id)}
                            className="p-1.5 hover:bg-danger/10 rounded-md transition-colors"
                            title="Remove machine"
                          >
                            <Trash2 size={14} className="text-danger/70" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {machines.length} machines</span>
          <span>
            {machines.filter((m) => m.status === 'active').length} active ·{' '}
            {machines.filter((m) => m.status === 'maintenance').length} maintenance ·{' '}
            {machines.filter((m) => m.status === 'offline').length} offline
          </span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={addOpen || !!editMachine}
        onClose={() => { setAddOpen(false); setEditMachine(null); }}
        title={editMachine ? `Edit ${editMachine.machineNumber}` : 'Add New Machine'}
        subtitle={editMachine ? 'Update machine configuration' : 'Register a new machine to the master'}
        size="md"
      >
        <MachineForm
          initial={editMachine ?? undefined}
          items={items}
          onSave={handleSave}
          onCancel={() => { setAddOpen(false); setEditMachine(null); }}
        />
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove Machine"
        subtitle="This action cannot be undone"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-semibold bg-danger text-white rounded-md hover:bg-danger/90 transition-colors active:scale-95"
            >
              Remove Machine
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Removing this machine will not affect historical production entries. It will no longer be available for new production records.
        </p>
      </Modal>
      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Machines"
        templateHeaders={MACHINE_TEMPLATE_HEADERS}
        templateSampleRows={MACHINE_TEMPLATE_SAMPLE}
        templateFileName="machine_master_template.csv"
        validateRow={validateMachineRow}
        onImport={handleMachineImport}
      />
    </>
  );
}

