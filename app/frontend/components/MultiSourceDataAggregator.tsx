"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// Types for the component
interface DataSource {
  id: string;
  name: string;
  url: string;
  transform?: (data: any) => any;
  timeout?: number;
}

interface AggregatedData {
  sourceId: string;
  data: any;
  status: 'loading' | 'success' | 'error';
  error?: string;
  timestamp: number;
}

interface MultiSourceDataAggregatorProps {
  dataSources: DataSource[];
  onDataUpdate?: (aggregatedData: AggregatedData[]) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
  className?: string;
}

const MultiSourceDataAggregator: React.FC<MultiSourceDataAggregatorProps> = ({
  dataSources,
  onDataUpdate,
  autoRefresh = false,
  refreshInterval = 30000,
  maxRetries = 3,
  className = '',
}) => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState<{ [key: string]: number }>({});

  // Initialize aggregated data structure
  useEffect(() => {
    const initialData: AggregatedData[] = dataSources.map(source => ({
      sourceId: source.id,
      data: null,
      status: 'loading',
      timestamp: Date.now(),
    }));
    setAggregatedData(initialData);
  }, [dataSources]);

  // Fetch data from a single source with error handling and timeout
  const fetchFromSource = useCallback(async (source: DataSource): Promise<AggregatedData> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), source.timeout || 10000);

    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawData = await response.json();
      const transformedData = source.transform ? source.transform(rawData) : rawData;

      return {
        sourceId: source.id,
        data: transformedData,
        status: 'success',
        timestamp: Date.now(),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        sourceId: source.id,
        data: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now(),
      };
    }
  }, []);

  // Fetch data from all sources
  const fetchDataFromAllSources = useCallback(async () => {
    setIsRefreshing(true);
    
    const promises = dataSources.map(async (source) => {
      let retries = 0;
      let lastError: AggregatedData | null = null;

      while (retries <= (maxRetries || 0)) {
        try {
          const result = await fetchFromSource(source);
          if (result.status === 'success') {
            return result;
          }
          lastError = result;
          retries++;
          
          // Exponential backoff
          if (retries <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          }
        } catch (error) {
          retries++;
          if (retries > maxRetries) {
            lastError = {
              sourceId: source.id,
              data: null,
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              timestamp: Date.now(),
            };
          }
        }
      }

      return lastError || {
        sourceId: source.id,
        data: null,
        status: 'error',
        error: 'Max retries exceeded',
        timestamp: Date.now(),
      };
    });

    const results = await Promise.allSettled(promises);
    const newAggregatedData = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        sourceId: dataSources[index].id,
        data: null,
        status: 'error',
        error: 'Promise rejected',
        timestamp: Date.now(),
      };
    });

    setAggregatedData(newAggregatedData);
    setIsRefreshing(false);
    onDataUpdate?.(newAggregatedData);
  }, [dataSources, fetchFromSource, maxRetries, onDataUpdate]);

  // Initial data fetch
  useEffect(() => {
    if (dataSources.length > 0) {
      fetchDataFromAllSources();
    }
  }, [dataSources.length]); // Only run when dataSources length changes

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchDataFromAllSources();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchDataFromAllSources]);

  // Get status icon for each source
  const getStatusIcon = (status: 'loading' | 'success' | 'error') => {
    switch (status) {
      case 'loading':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  // Get overall status
  const getOverallStatus = () => {
    const total = aggregatedData.length;
    const successful = aggregatedData.filter(item => item.status === 'success').length;
    const failed = aggregatedData.filter(item => item.status === 'error').length;
    const loading = aggregatedData.filter(item => item.status === 'loading').length;

    return { total, successful, failed, loading };
  };

  const status = getOverallStatus();

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Data Aggregator</h2>
          <p className="text-sm text-gray-600 mt-1">
            {status.successful} of {status.total} sources loaded successfully
          </p>
        </div>
        <button
          onClick={fetchDataFromAllSources}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">Successful</p>
              <p className="text-2xl font-bold text-green-900">{status.successful}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Failed</p>
              <p className="text-2xl font-bold text-red-900">{status.failed}</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">Loading</p>
              <p className="text-2xl font-bold text-blue-900">{status.loading}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Data Sources</h3>
        <AnimatePresence>
          {aggregatedData.map((item, index) => {
            const source = dataSources.find(s => s.id === item.sourceId);
            if (!source) return null;

            return (
              <motion.div
                key={item.sourceId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(item.status)}
                      <h4 className="font-medium text-gray-800">{source.name}</h4>
                      <span className="text-xs text-gray-500">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{source.url}</p>
                    
                    {item.status === 'error' && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-red-700">{item.error}</p>
                      </div>
                    )}

                    {item.status === 'success' && item.data && (
                      <div className="mt-3">
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                            View Data ({typeof item.data === 'object' ? Object.keys(item.data).length : String(item.data).length} items)
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(item.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
          <RefreshCw className="w-4 h-4" />
          <span>Auto-refresh every {refreshInterval / 1000} seconds</span>
        </div>
      )}
    </div>
  );
};

export default MultiSourceDataAggregator;
