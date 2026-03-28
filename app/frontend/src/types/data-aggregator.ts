export interface DataSource {
  id: string;
  name: string;
  endpoint: string;
  priority: number;
  timeout?: number;
  retryCount?: number;
  headers?: Record<string, string>;
  transform?: (data: any) => any;
}

export interface AggregatedData {
  sourceId: string;
  data: any;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  error?: string;
  metadata?: {
    responseTime?: number;
    retryAttempts?: number;
    dataSize?: number;
  };
}

export interface LoadingState {
  isLoading: boolean;
  progress: number;
  currentSource?: string;
}

export interface DataAggregationConfig {
  mergeStrategy: 'merge' | 'override' | 'combine';
  autoRefresh: boolean;
  refreshInterval: number;
  showDetailedStatus: boolean;
  enableCaching: boolean;
  cacheTimeout: number;
}

export interface NormalizedDataItem {
  id?: string | number;
  _source: string;
  _timestamp: string;
  [key: string]: any;
}

export interface AggregationMetrics {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  totalDataPoints: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

export type MergeStrategy = 'merge' | 'override' | 'combine';
export type DataSourceStatus = 'success' | 'error' | 'pending';
