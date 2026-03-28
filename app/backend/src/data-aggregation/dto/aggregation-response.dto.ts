import { AggregatedSourceDto } from './aggregated-source.dto';

export class AggregationResponseDto {
  success: boolean;
  data: any[];
  sources: AggregatedSourceDto[];
  successCount: number;
  failureCount: number;
  totalSources: number;
  responseTime: number;
  timestamp: Date;
  mergeStrategy: 'merge' | 'override' | 'combine';
  error?: string;
  warnings?: string[];
  metadata?: {
    totalDataPoints: number;
    averageResponseTime: number;
    cacheHit?: boolean;
  };
}
