'use client';

import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Lock, Clock, HelpCircle } from 'lucide-react';
import type { PointBalanceProps, PointBalance } from '@/types/pointBalance';

const PointBalance: React.FC<PointBalanceProps> = ({
  balance = null,
  fullBalance = null,
  isLoading = false,
  error = null,
  onRefresh = undefined,
  autoRefresh = true,
  refreshInterval = 30000,
  showCurrency = true,
  currency = 'PTS',
  decimals = 2,
  variant = 'compact',
  tooltip = undefined,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Use fullBalance if provided, otherwise create a simple balance object
  const displayBalance: PointBalance | null = fullBalance || (balance ? {
    id: 'balance-' + Date.now(),
    userId: 'current',
    totalBalance: balance,
    availableBalance: balance,
    lockedBalance: 0,
    pendingBalance: 0,
    currency,
    decimals,
    lastUpdated: new Date(),
  } : null);

  const formatNumber = (num: number, decimalsParam?: number) => {
    const decimalCount = decimalsParam ?? decimals ?? 2;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimalCount,
      maximumFractionDigits: decimalCount,
    });
  };

  const getPercentageColor = (percentage?: number) => {
    if (!percentage) return 'text-gray-600';
    if (percentage > 0) return 'text-green-600';
    return 'text-red-600';
  };

  const getPercentageIcon = (percentage?: number) => {
    if (!percentage) return null;
    if (percentage > 0) return <TrendingUp size={16} className="inline" />;
    return <TrendingDown size={16} className="inline" />;
  };

  // Loading state
  if (isLoading && !displayBalance) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded w-32"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="ml-2 text-xs underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // No balance state
  if (!displayBalance) {
    return (
      <div className={`text-gray-500 text-sm ${className}`}>
        No balance data available
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Main balance display */}
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-900">
            {formatNumber(displayBalance.totalBalance, displayBalance.decimals)}
          </span>
          {showCurrency && (
            <span className="text-sm font-medium text-gray-600">{displayBalance.currency || currency}</span>
          )}
        </div>

        {/* Percentage change indicator */}
        {displayBalance.percentageChange && (
          <span className={`text-sm font-medium flex items-center gap-0.5 ${getPercentageColor(displayBalance.percentageChange)}`}>
            {getPercentageIcon(displayBalance.percentageChange)}
            {Math.abs(displayBalance.percentageChange)}%
          </span>
        )}

        {/* Tooltip trigger */}
        <div className="relative">
          <button
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Balance information"
          >
            <HelpCircle size={16} className="text-gray-400" />
          </button>

          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
              {tooltip || `Balance as of ${new Date(displayBalance.lastUpdated).toLocaleTimeString()}`}
            </div>
          )}
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
            aria-label="Refresh balance"
          >
            <Zap size={16} className={`${isLoading ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
          </button>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`p-4 bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Point Balance</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 transition-colors"
            aria-label="Refresh balance"
          >
            <Zap size={18} className={`${isLoading ? 'animate-spin text-blue-500' : 'text-gray-600'}`} />
          </button>
        )}
      </div>

      {/* Total balance */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-1">Total Balance</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatNumber(displayBalance.totalBalance, displayBalance.decimals)}
          </span>
          <span className="text-lg font-medium text-gray-600">{displayBalance.currency || currency}</span>
          {displayBalance.percentageChange && (
            <span className={`text-sm font-medium ml-2 ${getPercentageColor(displayBalance.percentageChange)}`}>
              {displayBalance.percentageChange > 0 ? '+' : ''}{displayBalance.percentageChange}%
            </span>
          )}
        </div>
      </div>

      {/* Balance breakdown toggle */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="w-full text-left text-sm font-medium text-blue-600 hover:text-blue-700 pb-3 border-b border-gray-200 mb-3"
      >
        {showBreakdown ? '▼' : '▶'} Balance Breakdown
      </button>

      {/* Balance breakdown */}
      {showBreakdown && (
        <div className="space-y-3 mb-4">
          {/* Available balance */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-700">Available</span>
            </div>
            <span className="font-medium text-gray-900">
              {formatNumber(displayBalance.availableBalance, displayBalance.decimals)}
            </span>
          </div>

          {/* Locked balance */}
          {displayBalance.lockedBalance > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-yellow-600" />
                <span className="text-sm text-gray-700">Locked</span>
              </div>
              <span className="font-medium text-gray-900">
                {formatNumber(displayBalance.lockedBalance, displayBalance.decimals)}
              </span>
            </div>
          )}

          {/* Pending balance */}
          {displayBalance.pendingBalance > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-blue-600" />
                <span className="text-sm text-gray-700">Pending</span>
              </div>
              <span className="font-medium text-gray-900">
                {formatNumber(displayBalance.pendingBalance, displayBalance.decimals)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last updated info */}
      <div className="text-xs text-gray-500 pt-3 border-t border-gray-100">
        Last updated: {new Date(displayBalance.lastUpdated).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PointBalance;
