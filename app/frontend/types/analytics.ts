export interface MetricData {
  title: string;
  value: string | number;
  change: number; // percentage, e.g., +12.5 or -3.2
  trend: 'up' | 'down' | 'neutral';
  timeframe: string;
}

export interface ChartDataPoint {
  timestamp: string;
  eventsCount: number;
  activeUsers: number;
  gasSpentGwei?: number;
}

export interface EventAnalyticsData {
  totalEvents: MetricData;
  activeUsers: MetricData;
  transactionVolume: MetricData;
  errorRate: MetricData;
  chartData: ChartDataPoint[];
}

export type RefreshInterval = 5000 | 10000 | 30000 | 60000 | 0; // 0 = manual/off