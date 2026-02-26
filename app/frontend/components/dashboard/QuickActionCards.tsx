'use client';

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface QuickActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  onAction: () => void;
}

interface QuickActionCardsProps {
  actions: QuickActionItem[];
  title?: string;
  className?: string;
}

export function QuickActionCards({
  actions,
  title = 'Quick Actions',
  className = '',
}: QuickActionCardsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Shortcuts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onAction}
            className="group flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10 focus-visible:border-blue-400 dark:border-gray-800 dark:bg-gray-900"
            aria-label={action.label}
          >
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-blue-50 p-2 text-blue-600 transition-colors group-hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:group-hover:bg-blue-900/50">
                {action.icon}
              </span>
              <span className="text-sm font-semibold text-gray-800 transition-colors group-hover:text-blue-700 dark:text-gray-100 dark:group-hover:text-blue-300">
                {action.label}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-blue-500" />
          </button>
        ))}
      </div>
    </section>
  );
}
