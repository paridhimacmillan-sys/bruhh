'use client';
import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Item, Machine } from '@/lib/mockData';

interface ItemFormData {
  itemName: string;
  defaultRate: number;
  status: 'active' | 'inactive';
  rates: { machineId: string; rate: number }[];
}

interface Props {
  initial?: Item;
  machines: Machine[];
  onSave: (data: Partial<Item>) => void;
  onCancel: () => void;
}

export default function ItemForm({ initial, machines, onSave, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormData>({
    defaultValues: {
      itemName: initial?.itemName ?? '',
      defaultRate: initial?.defaultRate ?? 60,
      status: initial?.status ?? 'active',
      rates: initial?.rates ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'rates' });

  const onSubmit = (data: ItemFormData) => {
    onSave({
      ...data,
      rates: data.rates.map((r) => ({ machineId: r.machineId, rate: Number(r.rate) })),
    });
  };

  const usedMachineIds = fields.map((f) => f.machineId);
  const availableMachines = machines.filter((m) => !usedMachineIds.includes(m.id));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-foreground mb-1">
            Item Name <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">Full descriptive name including type/model</p>
          <input
            {...register('itemName', { required: 'Item name is required' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Spindle Shaft — Type A"
          />
          {errors.itemName && <p className="text-xs text-danger mt-1">{errors.itemName.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Default Production Rate <span className="text-danger">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">Fallback rate when no machine-specific rate is set</p>
          <div className="relative">
            <input
              type="number"
              {...register('defaultRate', {
                required: 'Rate is required',
                min: { value: 1, message: 'Rate must be at least 1' },
                max: { value: 9999, message: 'Rate cannot exceed 9999' },
              })}
              className="w-full px-3 py-2 pr-16 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
              placeholder="80"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pcs/hr</span>
          </div>
          {errors.defaultRate && <p className="text-xs text-danger mt-1">{errors.defaultRate.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
          <p className="text-xs text-muted-foreground mb-1.5">Inactive items won&apos;t appear in new entries</p>
          <select
            {...register('status')}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Per-machine rates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="block text-xs font-semibold text-foreground">Machine-Specific Rates</label>
            <p className="text-xs text-muted-foreground mt-0.5">Override default rate for specific machines</p>
          </div>
          {availableMachines.length > 0 && (
            <button
              type="button"
              onClick={() => append({ machineId: availableMachines[0].id, rate: 60 })}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              <Plus size={13} />
              Add Rate
            </button>
          )}
        </div>
        <div className="space-y-2">
          {fields.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-md">
              No machine-specific rates — default rate will be used for all machines
            </div>
          )}
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <select
                {...register(`rates.${index}.machineId`)}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              >
                {machines.map((m) => (
                  <option key={`rate-machine-${m.id}-${index}`} value={m.id}>
                    {m.machineNumber} — {m.machineType}
                  </option>
                ))}
              </select>
              <div className="relative w-32">
                <input
                  type="number"
                  {...register(`rates.${index}.rate`, { min: 1, max: 9999 })}
                  className="w-full px-3 py-2 pr-14 text-sm border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-ring font-mono-nums"
                  placeholder="80"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pcs/hr</span>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-2 hover:bg-danger/10 rounded-md transition-colors"
                title="Remove this rate"
              >
                <Trash2 size={13} className="text-danger/70" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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
            initial ? 'Update Item' : 'Add Item'
          )}
        </button>
      </div>
    </form>
  );
}