'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw, Database, Activity, CheckCircle, XCircle } from 'lucide-react';
import { DataSource, AggregatedData, LoadingState } from '../../types/data-aggregator';

interface MultiSourceDataAggregatorProps {
  dataSources: DataSource[];
  onDataAggregated?: (data: AggregatedData[]) => void;
  mergeStrategy?: 'merge' | 'override' | 'combine';
  autoRefresh?: boolean;
  refreshInterval?: number;
  showDetailedStatus?: boolean;
}

const MultiSourceDataAggregator: React.FC<MultiSourceDataAggregatorProps> = ({
  dataSources,
  onDataAggregated,
  mergeStrategy = 'merge',
  autoRefresh = false,
  refreshInterval = 30000,
  showDetailedStatus = false
}) => {
  const [aggregatedData, setAggregatedData] = useState<AggregatedData[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    progress: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDataFromSource = useCallback(async (source: DataSource): Promise<AggregatedData> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), source.timeout || 10000);

    try {
      const response = await fetch(source.endpoint, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        sourceId: source.id,
        data,
        timestamp: new Date(),
        status: 'success'
      };
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error(`Request to ${source.name} timed out`);
        }
        throw err;
      }
      
      throw new Error(`Unknown error fetching from ${source.name}`);
    }
  }, []);

  const fetchWithRetry = useCallback(async (source: DataSource, retries = 0): Promise<AggregatedData> => {
    const maxRetries = source.retryCount || 2;
    
    try {
      return await fetchDataFromSource(source);
    } catch (err) {
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return fetchWithRetry(source, retries + 1);
      }
      
      return {
        sourceId: source.id,
        data: null,
        timestamp: new Date(),
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }, [fetchDataFromSource]);

  const normalizeData = useCallback((data: any, sourceId: string): any => {
    if (!data) return null;
    
    if (Array.isArray(data)) {
      return data.map(item => ({
        ...item,
        _source: sourceId,
        _timestamp: new Date().toISOString()
      }));
    }
    
    return {
      ...data,
      _source: sourceId,
      _timestamp: new Date().toISOString()
    };
  }, []);

  const mergeData = useCallback((dataArray: AggregatedData[]): any[] => {
    const successfulData = dataArray
      .filter(item => item.status === 'success' && item.data)
      .map(item => normalizeData(item.data, item.sourceId));

    switch (mergeStrategy) {
      case 'override':
        return successfulData.flat().reverse();
      case 'combine':
        return successfulData.flat();
      case 'merge':
      default:
        const merged = new Map();
        successfulData.flat().forEach(item => {
          const key = item.id || JSON.stringify(item);
          merged.set(key, { ...merged.get(key), ...item });
        });
        return Array.from(merged.values());
    }
  }, [mergeStrategy, normalizeData]);

  const aggregateData = useCallback(async () => {
    setLoadingState({ isLoading: true, progress: 0 });
    setError(null);
    
    const sortedSources = [...dataSources].sort((a, b) => a.priority - b.priority);
    const results: AggregatedData[] = [];
    
    for (let i = 0; i < sortedSources.length; i++) {
      const source = sortedSources[i];
      setLoadingState({
        isLoading: true,
        progress: (i / sortedSources.length) * 100,
        currentSource: source.name
      });
      
      try {
        const result = await fetchWithRetry(source);
        results.push(result);
      } catch (err) {
        const errorResult: AggregatedData = {
          sourceId: source.id,
          data: null,
          timestamp: new Date(),
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        };
        results.push(errorResult);
      }
    }
    
    setAggregatedData(results);
    setLastUpdated(new Date());
    setLoadingState({ isLoading: false, progress: 100 });
    
    const mergedData = mergeData(results);
    onDataAggregated?.(results);
    
    const hasFailures = results.some(r => r.status === 'error');
    if (hasFailures) {
      const failedSources = results.filter(r => r.status === 'error').map(r => r.sourceId);
      setError(`Partial failure: ${failedSources.join(', ')}`);
    }
  }, [dataSources, fetchWithRetry, mergeData, onDataAggregated]);

  const handleRefresh = useCallback(() => {
    aggregateData();
  }, [aggregateData]);

  useEffect(() => {
    if (dataSources.length > 0) {
      aggregateData();
    }
  }, [dataSources.length, aggregateData]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(handleRefresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, handleRefresh]);

  const getStatusIcon = (status: 'success' | 'error' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
    }
  };

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Database className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Multi-Source Data Aggregator</h2>
          {loadingState.isLoading && (
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-600">
                {loadingState.currentSource && `Fetching from ${loadingState.currentSource}...`}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loadingState.isLoading}
            className="p-2 text-gray-600 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loadingState.isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loadingState.isLoading && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-blue-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${loadingState.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Loading progress: {Math.round(loadingState.progress)}%
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">{error}</p>
        </div>
      )}

      {showDetailedStatus && aggregatedData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Source Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {aggregatedData.map((item) => (
              <div
                key={item.sourceId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center space-x-2">
                  {getStatusIcon(item.status)}
                  <span className="text-sm font-medium text-gray-700">
                    {dataSources.find(s => s.id === item.sourceId)?.name || item.sourceId}
                  </span>
                </div>
                {item.status === 'success' && (
                  <span className="text-xs text-gray-500">
                    {item.timestamp.toLocaleTimeString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Data Aggregation Complete</p>
          <p className="text-sm text-gray-500 mt-1">
            {aggregatedData.filter(d => d.status === 'success').length} of {dataSources.length} sources loaded successfully
          </p>
        </div>
      </div>
    </div>
  );
};

export default MultiSourceDataAggregator;
