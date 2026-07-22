'use client';

import React from 'react';
import { MetricData } from '@/types/analytics';

interface MetricCardProps {
  data?: MetricData;
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ data, isLoading }) => {
  if (isLoading || !data) {
    return (
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse">
        <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-800 rounded mb-4" />
        <div className="h-8 w-3/4 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
        <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const isPositive = data.change >= 0;

  return (
    <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-md">
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{data.title}</h3>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{data.value}</span>
        <span
          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
            isPositive
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {isPositive ? '+' : ''}
          {data.change}%
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">{data.timeframe}</p>
    </div>
  );
};