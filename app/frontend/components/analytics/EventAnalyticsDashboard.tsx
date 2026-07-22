'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MetricCard } from './MetricCard';
import { EventAnalyticsData, RefreshInterval } from '@/types/analytics';

// Mock API generator for live refresh testing
const fetchAnalyticsData = async (): Promise<EventAnalyticsData> => {
  await new Promise((res) => setTimeout(res, 800)); // Simulate latency
  return {
    totalEvents: {
      title: 'Total Contract Events',
      value: (Math.floor(Math.random() * 500) + 12400).toLocaleString(),
      change: 14.2,
      trend: 'up',
      timeframe: 'vs. previous 24h',
    },
    activeUsers: {
      title: 'Active Wallets',
      value: (Math.floor(Math.random() * 50) + 1820).toLocaleString(),
      change: 5.8,
      trend: 'up',
      timeframe: 'vs. previous 24h',
    },
    transactionVolume: {
      title: 'Total Gas Volume (Gwei)',
      value: (Math.random() * 2 + 4.5).toFixed(2) + ' M',
      change: -2.1,
      trend: 'down',
      timeframe: 'vs. previous 24h',
    },
    errorRate: {
      title: 'Failed Event Ratio',
      value: (Math.random() * 0.4 + 0.1).toFixed(2) + '%',
      change: -0.4,
      trend: 'up',
      timeframe: 'vs. previous 24h',
    },
    chartData: [
      { timestamp: '00:00', eventsCount: 420, activeUsers: 110 },
      { timestamp: '04:00', eventsCount: 680, activeUsers: 190 },
      { timestamp: '08:00', eventsCount: 1250, activeUsers: 450 },
      { timestamp: '12:00', eventsCount: 940, activeUsers: 320 },
      { timestamp: '16:00', eventsCount: 1510, activeUsers: 580 },
      { timestamp: '20:00', eventsCount: 1100, activeUsers: 410 },
    ],
  };
};

export const EventAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<EventAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10000);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await fetchAnalyticsData();
      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Live Auto-Refresh Effect
  useEffect(() => {
    if (refreshInterval === 0) return;

    const timer = setInterval(() => {
      loadData(false);
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [refreshInterval, loadData]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!data) return;

    const rows = [
      ['Metric', 'Value', 'Change (%)', 'Timeframe'],
      [data.totalEvents.title, data.totalEvents.value, data.totalEvents.change, data.totalEvents.timeframe],
      [data.activeUsers.title, data.activeUsers.value, data.activeUsers.change, data.activeUsers.timeframe],
      [data.transactionVolume.title, data.transactionVolume.value, data.transactionVolume.change, data.transactionVolume.timeframe],
      [data.errorRate.title, data.errorRate.value, data.errorRate.change, data.errorRate.timeframe],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `event_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6">
      {/* Dashboard Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Event Analytics</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading metrics...'}
            {isRefreshing && <span className="ml-2 text-blue-500 font-medium">Refreshing...</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh Selector */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value) as RefreshInterval)}
            className="text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5000}>Auto Refresh: 5s</option>
            <option value={10000}>Auto Refresh: 10s</option>
            <option value={30000}>Auto Refresh: 30s</option>
            <option value={0}>Auto Refresh: Off</option>
          </select>

          {/* Manual Refresh Button */}
          <button
            onClick={() => loadData(false)}
            disabled={isLoading || isRefreshing}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            🔄 Refresh
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            disabled={isLoading || !data}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Responsive Grid for Metric Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard data={data?.totalEvents} isLoading={isLoading} />
        <MetricCard data={data?.activeUsers} isLoading={isLoading} />
        <MetricCard data={data?.transactionVolume} isLoading={isLoading} />
        <MetricCard data={data?.errorRate} isLoading={isLoading} />
      </div>
    </div>
  );
};