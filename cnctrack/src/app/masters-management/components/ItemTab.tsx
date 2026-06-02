'use client';
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import { Item } from '@/lib/mockData';
import { getItems, getMachines, addItem, updateItem, deleteItem, subscribe } from '@/lib/store';
import ItemForm from './ItemForm';
import ImportModal, { ImportRow, ImportError } from './ImportModal';
import { useAccess } from '@/lib/useAccess';

export default function ItemTab() {
  const { access } = useAccess();
  const [items, setItems] = useState<Item[]>(() => getItems());
  const [machines, setMachines] = useState(() => getMachines());
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'itemName' | 'defaultRate'>('itemName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [importOpen, setImportOpen] = useState(false);

  const ITEM_TEMPLATE_HEADERS = ['itemName', 'defaultRate', 'status'];
  const ITEM_TEMPLATE_SAMPLE = [
    ['Gear Shaft A', '120', 'active'],
    ['Bracket Type B', '85', 'active'],
  ];

  const validateItemRow = (row: ImportRow, index: number): ImportError[] => {
    const errs: ImportError[] = [];
    if (!row['itemname']?.trim()) errs.push({ row: index, field: 'itemName', message: 'Required' });
    const rate = Number(row['defaultrate']);
    if (!row['defaultrate'] || isNaN(rate) || rate < 0) {
      errs.push({ row: index, field: 'defaultRate', message: 'Must be a non-negative number' });
    }
    if (row['status'] && !['active', 'inactive'].includes(row['status'].toLowerCase())) {
      errs.push({ row: index, field: 'status', message: 'Must be "active" or "inactive"' });
    }
    return errs;
  };

  const handleItemImport = (rows: ImportRow[]) => {
    rows.forEach((row) => {
      const newItem: Item = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemName: row['itemname'] ?? '',
        defaultRate: Number(row['defaultrate']) || 0,
        rates: [],
        status: (row['status']?.toLowerCase() as 'active' | 'inactive') || 'active',
        unit: 'pcs/hr',
        createdAt: new Date().toISOString().split('T')[0],
      };
      addItem(newItem);
    });
    toast.success(`${rows.length} item${rows.length !== 1 ? 's' : ''} imported successfully`);
  };

  useEffect(() => {
    const unsub = subscribe(() => {
      setItems(getItems());
      setMachines(getMachines());
    });
    return unsub;
  }, []);

  const toggleSort = (key: 'itemName' | 'defaultRate') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = items
    .filter((i) => {
      const q = search.toLowerCase();
      return (
        (statusFilter === 'all' || i.status === statusFilter) &&
        i.itemName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'defaultRate') {
        return sortDir === 'asc' ? a.defaultRate - b.defaultRate : b.defaultRate - a.defaultRate;
      }
      return sortDir === 'asc'
        ? a.itemName.localeCompare(b.itemName)
        : b.itemName.localeCompare(a.itemName);
    });

  const handleSave = async (data: Partial<Item>) => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    if (editItem) {
      try {
        await updateItem(editItem.id, data);
        toast.success(`${data.itemName} updated`);
      } catch {
        toast.error('Item could not be updated');
        return;
      }
    } else {
      const newItem: Item = {
        id: `item-${Date.now()}`,
        itemName: data.itemName ?? '',
        defaultRate: data.defaultRate ?? 0,
        rates: data.rates ?? [],
        status: data.status ?? 'active',
        unit: 'pcs/hr',
        createdAt: new Date().toISOString().split('T')[0],
      };
      addItem(newItem);
      toast.success(`${newItem.itemName} added to Item Master`);
    }
    setAddOpen(false);
    setEditItem(null);
  };

  const handleDelete = () => {
    if (!access.isAdmin) { toast.error('Admin access required'); return; }
    if (!deleteId) return;
    const it = items.find((x) => x.id === deleteId);
    deleteItem(deleteId);
    setDeleteId(null);
    toast.success(`${it?.itemName ?? 'Item'} removed from master`);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring w-56"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={`item-filter-${s}`}
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
            onClick={() => { setEditItem(null); setAddOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95"
          >
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th
                  className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('itemName')}
                >
                  <span className="flex items-center gap-1">
                    Item Name
                    {sortKey === 'itemName' && sortDir === 'asc' ? (
                      <ChevronUp size={12} className="text-primary" />
                    ) : sortKey === 'itemName' ? (
                      <ChevronDown size={12} className="text-primary" />
                    ) : (
                      <ChevronUp size={12} className="opacity-30" />
                    )}
                  </span>
                </th>
                <th
                  className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
                  onClick={() => toggleSort('defaultRate')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Default Rate
                    {sortKey === 'defaultRate' && sortDir === 'asc' ? (
                      <ChevronUp size={12} className="text-primary" />
                    ) : sortKey === 'defaultRate' ? (
                      <ChevronDown size={12} className="text-primary" />
                    ) : (
                      <ChevronUp size={12} className="opacity-30" />
                    )}
                  </span>
                </th>
                {machines.slice(0, 4).map((m) => (
                  <th
                    key={`th-rate-${m.id}`}
                    className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {m.machineNumber}
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center">
                    <p className="text-sm font-medium text-muted-foreground">No items match your search</p>
                    <p className="text-xs text-muted-foreground mt-1">Add a new item to the master list</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border hover:bg-muted/30 transition-colors group ${
                      idx % 2 === 0 ? '' : 'bg-muted/10'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground text-sm">{item.itemName}</p>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-mono-nums text-sm font-semibold text-foreground">
                      {item.defaultRate}
                      <span className="text-xs text-muted-foreground ml-1">pcs/hr</span>
                    </td>
                    {machines.slice(0, 4).map((m) => {
                      const rate = item.rates.find((r) => r.machineId === m.id);
                      return (
                        <td key={`rate-${item.id}-${m.id}`} className="px-3 py-3 text-right">
                          {rate ? (
                            <span className="font-mono-nums text-xs font-semibold text-foreground">{rate.rate}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'active' ? 'status-badge-active' : 'status-badge-offline'
                        }`}
                      >
                        {item.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground font-mono-nums">{item.createdAt}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={!access.isAdmin}
                          onClick={() => { setEditItem(item); setAddOpen(true); }}
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="Edit item"
                        >
                          <Edit2 size={14} className="text-muted-foreground" />
                        </button>
                        <button
                          disabled={!access.isAdmin}
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 hover:bg-danger/10 rounded-md transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={14} className="text-danger/70" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {items.length} items</span>
          <span>{items.filter((i) => i.status === 'active').length} active · {items.filter((i) => i.status === 'inactive').length} inactive</span>
        </div>
      </div>

      <Modal
        open={addOpen || !!editItem}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        title={editItem ? `Edit ${editItem.itemName}` : 'Add New Item'}
        subtitle={editItem ? 'Update item configuration and production rates' : 'Add an item and define per-machine production rates'}
        size="lg"
      >
        <ItemForm
          initial={editItem ?? undefined}
          machines={machines}
          onSave={handleSave}
          onCancel={() => { setAddOpen(false); setEditItem(null); }}
        />
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove Item"
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
              Remove Item
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Removing this item will not affect historical production entries. It will no longer be available for new production records.
        </p>
      </Modal>
      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Items"
        templateHeaders={ITEM_TEMPLATE_HEADERS}
        templateSampleRows={ITEM_TEMPLATE_SAMPLE}
        templateFileName="item_master_template.csv"
        validateRow={validateItemRow}
        onImport={handleItemImport}
      />
    </>
  );
}
