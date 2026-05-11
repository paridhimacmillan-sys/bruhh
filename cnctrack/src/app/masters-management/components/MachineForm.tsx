'use client';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Machine, Item } from '@/lib/mockData';

const MACHINE_TYPES = ['CNC Lathe', 'CNC Milling', 'CNC Turning', 'CNC Grinding', 'CNC Drilling', 'CNC EDM', 'CNC Router'];
const STATUS_OPTIONS = ['active', 'idle', 'maintenance', 'offline'];

interface MachineFormData {
  machineNumber: string;
  machineType: string;
  status: string;
  operatorName: string;
  assignedItems: string[];
}

interface Props {
  initial?: Machine;
  items: Item[];
  onSave: (data: Partial<Machine>) => void;
  onCancel: () => void;
}

export default function MachineForm({ initial, items, onSave, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MachineFormData>({
    defaultValues: {
      machineNumber: initial?.machineNumber ?? '',
      machineType: initial?.machineType ?? '',
      status: initial?.status ?? 'active',
      operatorName: initial?.operatorName ?? '',
      assignedItems: initial?.assignedItems ?? [],
    },
  });

  const assignedItems = watch('assignedItems');

  const toggleItem = (itemId: string) => {
    const current = assignedItems ?? [];
    if (current.includes(itemId)) {
      setValue('assignedItems', current.filter((id) => id !== itemId));
    } else {
      setValue('assignedItems', [...current, itemId]);
    }
  };

  const onSubmit = (data: MachineFormData) => {
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Machine Number <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">e.g. CNC1, CNC-A01</p>
          <input
            {...register('machineNumber', { required: 'Machine number is required' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
            placeholder="CNC1"
          />
          {errors.machineNumber && (
            <p className="text-xs text-danger mt-1">{errors.machineNumber.message}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Machine Type <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">Select the CNC category</p>
          <select
            {...register('machineType', { required: 'Machine type is required' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="">Select type...</option>
            {MACHINE_TYPES.map((t) => (
              <option key={`type-${t}`} value={t}>{t}</option>
            ))}
          </select>
          {errors.machineType && (
            <p className="text-xs text-danger mt-1">{errors.machineType.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
          <p className="text-xs text-muted-foreground mb-1.5">Current operational status</p>
          <select
            {...register('status')}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer capitalize"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={`status-opt-${s}`} value={s} className="capitalize">
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Assigned Operator</label>
          <p className="text-xs text-muted-foreground mb-1.5">Primary operator (optional)</p>
          <input
            {...register('operatorName')}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Operator name"
          />
        </div>
      </div>

      {/* Assigned Items */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1">
          Assigned Items
        </label>
        <p className="text-xs text-muted-foreground mb-2">Select items this machine can produce</p>
        {items.filter((i) => i.status === 'active').length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
            No active items available — add items in Item Master first
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto border border-border rounded-md p-2">
            {items
              .filter((i) => i.status === 'active')
              .map((item) => {
                const checked = (assignedItems ?? []).includes(item.id);
                return (
                  <label
                    key={`assign-${item.id}`}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-xs ${
                      checked
                        ? 'bg-primary/10 border border-primary/30 text-primary font-semibold' :'hover:bg-muted text-muted-foreground border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                      className="w-3.5 h-3.5 accent-primary shrink-0"
                    />
                    <span className="truncate">{item.itemName.split(' — ')[0]}</span>
                  </label>
                );
              })}
          </div>
        )}
        {(assignedItems ?? []).length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {(assignedItems ?? []).length} item{(assignedItems ?? []).length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-md hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-60 min-w-[100px]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            initial ? 'Update Machine' : 'Add Machine'
          )}
        </button>
      </div>
    </form>
  );
}