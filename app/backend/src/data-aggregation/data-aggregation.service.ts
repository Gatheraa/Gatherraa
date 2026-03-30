import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DataSourceConfigDto } from './dto/data-source-config.dto';
import { AggregationResponseDto } from './dto/aggregation-response.dto';
import { CreateAggregationRequestDto } from './dto/create-aggregation-request.dto';

@Injectable()
export class DataAggregationService {
  private readonly logger = new Logger(DataAggregationService.name);
  private readonly configuredSources: Map<string, DataSourceConfigDto> = new Map();
  private readonly metrics = {
    totalAggregations: 0,
    successfulAggregations: 0,
    totalResponseTime: 0,
    lastUpdated: new Date(),
  };

  constructor() {
    this.initializeDefaultSources();
  }

  private initializeDefaultSources(): void {
    const defaultSources: DataSourceConfigDto[] = [
      {
        id: 'users-api',
        name: 'Users API',
        endpoint: process.env.USERS_API_ENDPOINT || 'http://localhost:3001/api/users',
        priority: 1,
        timeout: 5000,
        retryCount: 2,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        id: 'events-api',
        name: 'Events API',
        endpoint: process.env.EVENTS_API_ENDPOINT || 'http://localhost:3002/api/events',
        priority: 2,
        timeout: 8000,
        retryCount: 3,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      {
        id: 'analytics-api',
        name: 'Analytics API',
        endpoint: process.env.ANALYTICS_API_ENDPOINT || 'http://localhost:3003/api/analytics',
        priority: 3,
        timeout: 10000,
        retryCount: 1,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ];

    defaultSources.forEach(source => {
      this.configuredSources.set(source.id, source);
    });

    this.logger.log(`Initialized ${defaultSources.length} default data sources`);
  }

  async aggregateData(
    dataSources: DataSourceConfigDto[],
    mergeStrategy: 'merge' | 'override' | 'combine' = 'merge',
    timeout: number = 10000,
  ): Promise<AggregationResponseDto> {
    const startTime = Date.now();
    this.metrics.totalAggregations++;

    try {
      const sortedSources = [...dataSources].sort((a, b) => a.priority - b.priority);
      const promises = sortedSources.map(source => this.fetchFromSource(source, timeout));

      const results = await Promise.allSettled(promises);
      
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const failedResults = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => ({
          sourceId: this.extractSourceIdFromError(result.reason),
          error: result.reason.message,
          status: 'error' as const,
          timestamp: new Date(),
          data: null,
        }));

      const allResults = [...successfulResults, ...failedResults];
      const mergedData = this.mergeData(allResults, mergeStrategy);

      const responseTime = Date.now() - startTime;
      this.metrics.successfulAggregations++;
      this.metrics.totalResponseTime += responseTime;
      this.metrics.lastUpdated = new Date();

      return {
        success: true,
        data: mergedData,
        sources: allResults,
        successCount: successfulResults.length,
        failureCount: failedResults.length,
        totalSources: dataSources.length,
        responseTime,
        timestamp: new Date(),
        mergeStrategy,
      };
    } catch (error) {
      this.logger.error('Data aggregation failed', error);
      throw error;
    }
  }

  private async fetchFromSource(
    source: DataSourceConfigDto,
    globalTimeout: number,
  ): Promise<any> {
    const sourceTimeout = source.timeout || globalTimeout;
    const startTime = Date.now();

    try {
      const response = await axios.get(source.endpoint, {
        headers: source.headers,
        timeout: sourceTimeout,
      });

      const responseTime = Date.now() - startTime;
      this.logger.debug(`Successfully fetched from ${source.name} in ${responseTime}ms`);

      return {
        sourceId: source.id,
        data: response.data,
        status: 'success' as const,
        timestamp: new Date(),
        metadata: {
          responseTime,
          dataSize: JSON.stringify(response.data).length,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`Failed to fetch from ${source.name}`, error);

      return {
        sourceId: source.id,
        data: null,
        status: 'error' as const,
        timestamp: new Date(),
        error: error.message || 'Unknown error',
        metadata: {
          responseTime,
          retryAttempts: source.retryCount || 0,
        },
      };
    }
  }

  private mergeData(
    results: any[],
    strategy: 'merge' | 'override' | 'combine',
  ): any[] {
    const successfulData = results
      .filter(result => result.status === 'success' && result.data)
      .map(result => this.normalizeData(result.data, result.sourceId));

    switch (strategy) {
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
  }

  private normalizeData(data: any, sourceId: string): any {
    if (!data) return null;

    if (Array.isArray(data)) {
      return data.map(item => ({
        ...item,
        _source: sourceId,
        _timestamp: new Date().toISOString(),
      }));
    }

    return {
      ...data,
      _source: sourceId,
      _timestamp: new Date().toISOString(),
    };
  }

  private extractSourceIdFromError(error: Error): string {
    const match = error.message.match(/Failed to fetch from (.+?):/);
    return match ? match[1] : 'unknown';
  }

  async getConfiguredSources(): Promise<DataSourceConfigDto[]> {
    return Array.from(this.configuredSources.values());
  }

  async addDataSource(dataSourceConfig: DataSourceConfigDto): Promise<DataSourceConfigDto> {
    if (this.configuredSources.has(dataSourceConfig.id)) {
      throw new Error(`Data source with id '${dataSourceConfig.id}' already exists`);
    }

    this.configuredSources.set(dataSourceConfig.id, dataSourceConfig);
    this.logger.log(`Added new data source: ${dataSourceConfig.name}`);

    return dataSourceConfig;
  }

  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    activeSources: number;
    lastAggregation?: string;
  }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeSources: this.configuredSources.size,
      lastAggregation: this.metrics.lastUpdated.toISOString(),
    };
  }

  async getMetrics(): Promise<{
    totalAggregations: number;
    successRate: number;
    averageResponseTime: number;
    lastUpdated: string;
  }> {
    const successRate = this.metrics.totalAggregations > 0
      ? (this.metrics.successfulAggregations / this.metrics.totalAggregations) * 100
      : 0;

    const averageResponseTime = this.metrics.successfulAggregations > 0
      ? this.metrics.totalResponseTime / this.metrics.successfulAggregations
      : 0;

    return {
      totalAggregations: this.metrics.totalAggregations,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      lastUpdated: this.metrics.lastUpdated.toISOString(),
    };
  }

  async testConnection(
    endpoint: string,
    headers?: Record<string, string>,
  ): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await axios.get(endpoint, {
        headers,
        timeout: 5000,
      });

      const responseTime = Date.now() - startTime;
      return {
        success: true,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error.message,
      };
    }
  }
}
