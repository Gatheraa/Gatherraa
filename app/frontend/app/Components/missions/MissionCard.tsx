'use client';

import { Clock, Trophy } from "lucide-react";

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

export default function MissionCard({ mission }: { mission: Mission }) {
  const status = statusConfig[mission.status];
  const category = categoryConfig[mission.category];

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{category.icon}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{category.label}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {mission.title}
          </h3>
        </div>
        <span className={`shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
        {mission.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {mission.tags.map((tag) => (
          <span key={tag} className="inline-flex px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700 mt-auto">
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{mission.deadline}</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-gray-900 dark:text-white text-sm">${mission.reward}</span>
        </div>
      </div>
    </div>
    </div>
  );
}