'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui';

export interface EventCapacityIndicatorProps {
  /** Total capacity of the event */
  totalCapacity: number;
  /** Currently registered users */
  registeredUsers: number;
  /** Whether to show live update indicator */
  isLive?: boolean;
  /** Custom className */
  className?: string;
}

export function EventCapacityIndicator({
  totalCapacity,
  registeredUsers,
  isLive = false,
  className = '',
}: EventCapacityIndicatorProps) {
  const percentage = Math.min(Math.max((registeredUsers / totalCapacity) * 100, 0), 100) || 0;
  const isSoldOut = registeredUsers >= totalCapacity;
  const isAlmostFull = percentage >= 80 && !isSoldOut;
  const spotsLeft = Math.max(totalCapacity - registeredUsers, 0);

  // Determine color based on capacity
  let barColor = 'bg-green-500';
  let textColor = 'text-green-600';
  let Icon = CheckCircle;
  let statusLabel = 'Available';

  if (isSoldOut) {
    barColor = 'bg-red-500';
    textColor = 'text-red-600';
    Icon = AlertTriangle;
    statusLabel = 'Sold Out';
  } else if (isAlmostFull) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-600';
    Icon = AlertTriangle;
    statusLabel = 'Almost Full';
  }

  return (
    <div className={`w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Event Capacity</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <span className="text-xs text-green-600">Live</span>
            </span>
          )}
          <Badge variant={isSoldOut ? 'destructive' : isAlmostFull ? 'warning' : 'success'}>
            <Icon className="mr-1 h-3 w-3" />
            {statusLabel}
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div
            className={`h-full rounded-full ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className={`font-semibold ${textColor}`}>
          {registeredUsers.toLocaleString()} / {totalCapacity.toLocaleString()}
        </span>
        <span className="text-gray-500">
          {spotsLeft > 0 ? `${spotsLeft.toLocaleString()} spots left` : 'No spots remaining'}
        </span>
      </div>

      {/* Percentage */}
      <div className="mt-1 text-right text-xs text-gray-400">
        {percentage.toFixed(1)}% full
      </div>
    </div>
  );
}

export default EventCapacityIndicator;
