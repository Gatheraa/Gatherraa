'use client';

import React from 'react';
import { motion } from 'motion/react';

export interface CapacityProgressProps {
  currentCapacity: number;
  maxCapacity: number;
  className?: string;
}

export function CapacityProgress({
  currentCapacity,
  maxCapacity,
  className = '',
}: CapacityProgressProps) {
  const percentage = Math.min(Math.max((currentCapacity / maxCapacity) * 100, 0), 100) || 0;
  const isSoldOut = currentCapacity >= maxCapacity;

  // Determine the color based on how full the event is
  let progressColorClass = 'bg-green-500';
  if (isSoldOut) {
    progressColorClass = 'bg-red-500';
  } else if (percentage >= 90) {
    progressColorClass = 'bg-red-400';
  } else if (percentage >= 70) {
    progressColorClass = 'bg-yellow-500';
  }

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      <div className="flex justify-between items-center text-sm font-medium">
        <span className="text-[var(--text-secondary,gray-600)]">Capacity</span>
        {isSoldOut ? (
          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold tracking-wide dark:bg-red-900/30 dark:text-red-400">
            Sold Out!
          </span>
        ) : (
          <span className="text-[var(--text-primary,gray-900)]">
            {currentCapacity} / {maxCapacity}
          </span>
        )}
      </div>

      <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
        <motion.div
          className={`absolute top-0 left-0 h-full rounded-full ${progressColorClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      
      {!isSoldOut && percentage >= 90 && (
        <span className="text-xs text-red-500 font-medium">Almost full!</span>
      )}
    </div>
  );
}

CapacityProgress.displayName = 'CapacityProgress';
