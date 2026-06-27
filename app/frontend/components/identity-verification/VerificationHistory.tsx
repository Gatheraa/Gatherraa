'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Send,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import type {
  VerificationHistoryItem,
  VerificationAction,
} from '@/types/identity-verification';

interface VerificationHistoryProps {
  history: VerificationHistoryItem[];
}

const ACTION_CONFIG: Record<
  VerificationAction,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    label: string;
  }
> = {
  submitted: {
    icon: Send,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    label: 'Submitted',
  },
  approved: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    label: 'Approved',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    label: 'Rejected',
  },
  retried: {
    icon: RefreshCw,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    label: 'Retried',
  },
  expired: {
    icon: AlertTriangle,
    color: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-50 dark:bg-zinc-950/30',
    label: 'Expired',
  },
  cancelled: {
    icon: Ban,
    color: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-50 dark:bg-zinc-950/30',
    label: 'Cancelled',
  },
};

export function VerificationHistory({ history }: VerificationHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-3" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No verification history yet
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          History will appear as you complete verification steps.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-5 top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-800" />

      <div className="space-y-4">
        {history.map((entry, index) => {
          const config = ACTION_CONFIG[entry.action];
          const Icon = config.icon;

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="relative pl-12"
            >
              <div
                className={`absolute left-3.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-950 ${config.bg} ${config.color}`}
                style={{ top: '4px' }}
              />

              <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {config.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {entry.message && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.message}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
