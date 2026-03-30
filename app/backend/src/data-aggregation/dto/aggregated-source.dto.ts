export class AggregatedSourceDto {
  sourceId: string;
  data: any;
  status: 'success' | 'error' | 'pending';
  timestamp: Date;
  error?: string;
  metadata?: {
    responseTime?: number;
    retryAttempts?: number;
    dataSize?: number;
    statusCode?: number;
  };
}
