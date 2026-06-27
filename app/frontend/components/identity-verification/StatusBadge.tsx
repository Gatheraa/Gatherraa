'use client';

import type { VerificationStatus } from '@/types/identity-verification';

interface StatusBadgeProps {
  status: VerificationStatus;
}

const STATUS_STYLES: Record<VerificationStatus, string> = {
  pending:
    'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  in_progress:
    'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  completed:
    'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  failed:
    'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  expired:
    'bg-zinc-50 dark:bg-zinc-950/30 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800',
};

const STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Verified',
  failed: 'Failed',
  expired: 'Expired',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === 'completed'
            ? 'bg-emerald-500'
            : status === 'failed'
              ? 'bg-red-500'
              : status === 'in_progress'
                ? 'bg-blue-500 animate-pulse'
                : 'bg-amber-500'
        }`}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
