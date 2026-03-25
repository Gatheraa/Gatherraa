'use client';

import { Zap } from 'lucide-react';

type MissionStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';
type MissionCategory = 'development' | 'design' | 'research' | 'marketing' | 'other';

interface Mission {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: MissionStatus;
  category: MissionCategory;
  deadline: string;
  createdAt: string;
  tags: string[];
}

const statusConfig = {
  open: { label: 'Open', className: '' },
  'in-progress': { label: 'In Progress', className: '' },
  completed: { label: 'Completed', className: '' },
  cancelled: { label: 'Cancelled', className: '' },
};

const categoryConfig = {
  development: { label: 'Development', icon: '⚙️' },
  design: { label: 'Design', icon: '🎨' },
  research: { label: 'Research', icon: '🔍' },
  marketing: { label: 'Marketing', icon: '📣' },
  other: { label: 'Other', icon: '📌' },
};

export default function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No missions found</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        {hasFilters
          ? 'No missions match your current filters. Try adjusting your search or filters.'
          : 'There are no missions available right now. Check back soon.'}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}