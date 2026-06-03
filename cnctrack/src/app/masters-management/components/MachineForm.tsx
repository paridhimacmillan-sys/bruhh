'use client';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Machine, Item, MachineStatus } from '@/lib/mockData';

const STATUS_OPTIONS = ['active', 'idle', 'maintenance', 'offline'];

interface MachineFormData {
  machineNumber: string;
  machineType: string;
  expectedPerHour?: number;
  status: string;
  operatorName: string;
  assignedItems: string[];
}

interface Props {
  initial?: Machine;
  items: Item[];
  operators: string[];
  onSave: (data: Partial<Machine>) => void;
  onCancel: () => void;
}

export default function MachineForm({ initial, items, operators, onSave, onCancel }: Props) {
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
      expectedPerHour: initial?.expectedPerHour ?? undefined,
      status: initial?.status ?? 'active',
      operatorName: initial?.operatorName ?? '',
      assignedItems: initial?.assignedItems ?? [],
    },
  });

  const assignedItems = watch('assignedItems');
  const operatorOptions = Array.from(new Set([
    ...(initial?.operatorName ? [initial.operatorName] : []),
    ...operators,
  ].filter(Boolean)));

  const toggleItem = (itemId: string) => {
    const current = assignedItems ?? [];
    if (current.includes(itemId)) {
      setValue('assignedItems', current.filter((id) => id !== itemId));
    } else {
      setValue('assignedItems', [...current, itemId]);
    }
  };

  const onSubmit = (data: MachineFormData) => {
    const status = data.status as MachineStatus;
    onSave({ ...data, status });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Machine Number <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">e.g. MCH-01, PRESS-02</p>
          <input
            {...register('machineNumber', { required: 'Machine number is required' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
            placeholder="MCH-01"
          />
          {errors.machineNumber && (
            <p className="text-xs text-danger mt-1">{errors.machineNumber.message}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Machine Type <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">Enter any machine type used in your plant</p>
          <input
            {...register('machineType', { required: 'Machine type is required' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            placeholder="e.g. Packaging Line, Robot Cell, Press"
          />
          {errors.machineType && (
            <p className="text-xs text-danger mt-1">{errors.machineType.message}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Target Per Hour <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">Admin-defined expected output for this machine</p>
          <div className="relative">
            <input
              type="number"
              {...register('expectedPerHour', {
                required: 'Target per hour is required',
                min: { value: 1, message: 'Must be at least 1' },
                max: { value: 9999, message: 'Cannot exceed 9999' },
                valueAsNumber: true,
              })}
              className="w-full px-3 py-2 pr-16 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
              placeholder="e.g. 45"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pcs/hr</span>
          </div>
          {errors.expectedPerHour && (
            <p className="text-xs text-danger mt-1">{errors.expectedPerHour.message}</p>
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
          <p className="text-xs text-muted-foreground mb-1.5">Choose from Shift Operator Master</p>
          <select
            {...register('operatorName')}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="">Unassigned</option>
            {operatorOptions.map((operator) => (
              <option key={`machine-operator-${operator}`} value={operator}>
                {operator}
              </option>
            ))}
          </select>
          {operatorOptions.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Add operators in Shift Operator Master first.
            </p>
          )}
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
