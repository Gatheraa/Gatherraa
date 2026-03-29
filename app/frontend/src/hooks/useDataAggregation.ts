import { useState, useEffect, useCallback } from 'react';
import { DataSource, AggregatedData } from '../types/data-aggregator';

interface UseDataAggregationOptions {
  dataSources: DataSource[];
  mergeStrategy?: 'merge' | 'override' | 'combine';
  autoRefresh?: boolean;
  refreshInterval?: number;
  onSuccess?: (data: AggregatedData[]) => void;
  onError?: (error: string) => void;
}

interface UseDataAggregationReturn {
  data: AggregatedData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  mergedData: any[];
  successCount: number;
  failureCount: number;
  lastUpdated: Date | null;
}

export const useDataAggregation = ({
  dataSources,
  mergeStrategy = 'merge',
  autoRefresh = false,
  refreshInterval = 30000,
  onSuccess,
  onError
}: UseDataAggregationOptions): UseDataAggregationReturn => {
  const [data, setData] = useState<AggregatedData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

      const responseData = await response.json();
      
      return {
        sourceId: source.id,
        data: responseData,
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

  const normalizeData = useCallback((responseData: any, sourceId: string): any => {
    if (!responseData) return null;
    
    if (Array.isArray(responseData)) {
      return responseData.map(item => ({
        ...item,
        _source: sourceId,
        _timestamp: new Date().toISOString()
      }));
    }
    
    return {
      ...responseData,
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
    setIsLoading(true);
    setError(null);
    
    const sortedSources = [...dataSources].sort((a, b) => a.priority - b.priority);
    const results: AggregatedData[] = [];
    
    for (const source of sortedSources) {
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
    
    setData(results);
    setLastUpdated(new Date());
    setIsLoading(false);
    
    const hasFailures = results.some(r => r.status === 'error');
    if (hasFailures) {
      const errorMessage = `Partial failure: ${results.filter(r => r.status === 'error').map(r => r.sourceId).join(', ')}`;
      setError(errorMessage);
      onError?.(errorMessage);
    } else {
      onSuccess?.(results);
    }
  }, [dataSources, fetchWithRetry, onSuccess, onError]);

  const refetch = useCallback(() => {
    aggregateData();
  }, [aggregateData]);

  useEffect(() => {
    if (dataSources.length > 0) {
      aggregateData();
    }
  }, [dataSources.length, aggregateData]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(refetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refetch]);

  const successCount = data.filter(d => d.status === 'success').length;
  const failureCount = data.filter(d => d.status === 'error').length;
  const mergedData = mergeData(data);

  return {
    data,
    isLoading,
    error,
    refetch,
    mergedData,
    successCount,
    failureCount,
    lastUpdated
  };
};
