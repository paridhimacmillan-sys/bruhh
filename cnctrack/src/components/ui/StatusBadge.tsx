import React from 'react';

type StatusVariant =
  | 'active' |'idle' |'maintenance' |'offline' |'draft' |'submitted' |'flagged' |'complete' |'partial' |'locked';

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  active: 'status-badge-active',
  idle: 'status-badge-idle',
  maintenance: 'status-badge-maintenance',
  offline: 'status-badge-offline',
  draft: 'status-badge-draft',
  submitted: 'status-badge-submitted',
  flagged: 'status-badge-flagged',
  complete: 'status-badge-active',
  partial: 'status-badge-maintenance',
  locked: 'status-badge-idle',
};

const LABELS: Record<StatusVariant, string> = {
  active: 'Active',
  idle: 'Idle',
  maintenance: 'Maintenance',
  offline: 'Offline',
  draft: 'Draft',
  submitted: 'Submitted',
  flagged: 'Flagged',
  complete: 'Complete',
  partial: 'Partial',
  locked: 'Locked',
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, className = '', size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      } ${VARIANT_CLASSES[status]} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'active' || status === 'complete'
            ? 'bg-success'
            : status === 'offline'|| status === 'flagged' ?'bg-danger'
            : status === 'maintenance'|| status === 'partial' ?'bg-warning' :'bg-muted-foreground'
        }`}
      />
      {LABELS[status]}
    </span>
  );
}