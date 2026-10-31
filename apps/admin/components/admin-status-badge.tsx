import type { HTMLAttributes } from 'react';
import { formatAdminEnumLabel } from '@/lib/admin-display';

export type AdminStatusTone = 'active' | 'draft' | 'inactive' | 'archived';

export function resolveAdminStatusTone(status: string): AdminStatusTone {
  const normalized = status.trim().toUpperCase();

  if (
    normalized === 'ACTIVE' ||
    normalized === 'APPROVED' ||
    normalized === 'VERIFIED' ||
    normalized === 'COMPLETED' ||
    normalized === 'PUBLISHED' ||
    normalized === 'READY'
  ) {
    return 'active';
  }

  if (
    normalized === 'DRAFT' ||
    normalized === 'APPLICATION' ||
    normalized === 'PROVISIONED' ||
    normalized === 'PENDING' ||
    normalized === 'PENDING_REVIEW' ||
    normalized === 'UNVERIFIED'
  ) {
    return 'draft';
  }

  if (normalized === 'ARCHIVED') return 'archived';

  return 'inactive';
}

export function AdminStatusBadge({
  status,
  label,
  tone,
  className,
  ...props
}: {
  status: string;
  label?: string;
  tone?: AdminStatusTone;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const resolvedTone = tone ?? resolveAdminStatusTone(status);
  const classes = [
    'category-status',
    `category-status--${resolvedTone}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {label ?? formatAdminEnumLabel(status)}
    </span>
  );
}
