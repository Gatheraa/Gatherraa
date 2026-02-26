import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ApiUsageLog } from '../entities/api-usage-log.entity';
import { ApiKey } from '../entities/api-key.entity';
import { Redis } from 'ioredis';
import { subDays, subHours, startOfDay, endOfDay, startOfHour, endOfHour } from 'date-fns';

export interface UsageReport {
  period: string;
  totalRequests: number;
  uniqueUsers: number;
  uniqueApiKeys: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; count: number; avgResponseTime: number }>;
  topUsers: Array<{ userId: string; requests: number; cost: number }>;
  costBreakdown: {
    totalCost: number;
    overageCost: number;
    baseCost: number;
  };
  hourlyBreakdown: Array<{
    hour: string;
    requests: number;
    errors: number;
    avgResponseTime: number;
  }>;
}

export interface ApiAnalytics {
  apiKeyId: string;
  apiKeyName: string;
  userId: string;
  tier: string;
  usage: {
    totalRequests: number;
    totalCost: number;
    averageResponseTime: number;
    errorRate: number;
    lastUsedAt?: Date;
  };
  quotas: Array<{
    endpoint: string;
    period: string;
    limit: number;
    used: number;
    remaining: number;
    overage: number;
  }>;
  trends: {
    daily: Array<{ date: string; requests: number; cost: number }>;
    hourly: Array<{ hour: string; requests: number; avgResponseTime: number }>;
  };
}

@Injectable()
export class ApiUsageAnalyticsService {
  private readonly logger = new Logger(ApiUsageAnalyticsService.name);
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  constructor(
    @InjectRepository(ApiUsageLog)
    private usageLogRepository: Repository<ApiUsageLog>,
    @InjectRepository(ApiKey)
    private apiKeyRepository: Repository<ApiKey>,
  ) {}

  /**
   * Generate comprehensive usage report
   */
  async generateUsageReport(
    period: 'day' | 'week' | 'month' | 'year' = 'day',
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageReport> {
    const now = new Date();
    const reportStart = startDate || this.getPeriodStart(period, now);
    const reportEnd = endDate || this.getPeriodEnd(period, now);

    // Get usage data for the period
    const usageData = await this.usageLogRepository.find({
      where: {
        timestamp: Between(reportStart, reportEnd)
      }
    });

    // Calculate basic metrics
    const totalRequests = usageData.length;
    const uniqueUsers = new Set(usageData.filter(u => u.userId).map(u => u.userId)).size;
    const uniqueApiKeys = new Set(usageData.filter(u => u.apiKeyId).map(u => u.apiKeyId)).size;
    const averageResponseTime = usageData.length > 0 
      ? usageData.reduce((sum, u) => sum + u.responseTime, 0) / usageData.length 
      : 0;
    const errorRate = usageData.length > 0 
      ? (usageData.filter(u => u.statusCode >= 400).length / usageData.length) * 100 
      : 0;

    // Top endpoints
    const endpointStats = usageData.reduce((acc, u) => {
      if (!acc[u.endpoint]) {
        acc[u.endpoint] = { count: 0, totalResponseTime: 0 };
      }
      acc[u.endpoint].count++;
      acc[u.endpoint].totalResponseTime += u.responseTime;
      return acc;
    }, {} as Record<string, { count: number; totalResponseTime: number }>);

    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime: stats.totalResponseTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top users
    const userStats = usageData.reduce((acc, u) => {
      if (!u.userId) return acc;
      if (!acc[u.userId]) {
        acc[u.userId] = { requests: 0, cost: 0 };
      }
      acc[u.userId].requests++;
      acc[u.userId].cost += u.cost || 0;
      return acc;
    }, {} as Record<string, { requests: number; cost: number }>);

    const topUsers = Object.entries(userStats)
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Cost breakdown
    const totalCost = usageData.reduce((sum, u) => sum + (u.cost || 0), 0);
    const baseCost = totalCost * 0.8; // Assume 80% base cost
    const overageCost = totalCost * 0.2; // Assume 20% overage cost

    // Hourly breakdown
    const hourlyBreakdown = await this.getHourlyBreakdown(reportStart, reportEnd);

    return {
      period,
      totalRequests,
      uniqueUsers,
      uniqueApiKeys,
      averageResponseTime,
      errorRate,
      topEndpoints,
      topUsers,
      costBreakdown: {
        totalCost,
        overageCost,
        baseCost
      },
      hourlyBreakdown
    };
  }

  /**
   * Get analytics for a specific API key
   */
  async getApiKeyAnalytics(
    apiKeyId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<ApiAnalytics> {
    const now = new Date();
    const periodStart = this.getPeriodStart(period, now);
    const periodEnd = this.getPeriodEnd(period, now);

    // Get API key details
    const apiKey = await this.apiKeyRepository.findOne({ 
      where: { id: apiKeyId } 
    });
    
    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Get usage data
    const usageData = await this.usageLogRepository.find({
      where: {
        apiKeyId,
        timestamp: Between(periodStart, periodEnd)
      }
    });

    // Calculate usage metrics
    const totalRequests = usageData.length;
    const totalCost = usageData.reduce((sum, u) => sum + (u.cost || 0), 0);
    const averageResponseTime = usageData.length > 0 
      ? usageData.reduce((sum, u) => sum + u.responseTime, 0) / usageData.length 
      : 0;
    const errorRate = usageData.length > 0 
      ? (usageData.filter(u => u.statusCode >= 400).length / usageData.length) * 100 
      : 0;

    // Get trends
    const trends = await this.getApiKeyTrends(apiKeyId, period);

    return {
      apiKeyId,
      apiKeyName: apiKey.name,
      userId: apiKey.userId,
      tier: apiKey.tier,
      usage: {
        totalRequests,
        totalCost,
        averageResponseTime,
        errorRate,
        lastUsedAt: apiKey.lastUsedAt
      },
      quotas: [], // Would be populated from quota service
      trends
    };
  }

  /**
   * Get real-time usage metrics
   */
  async getRealTimeMetrics(): Promise<{
    requestsPerMinute: number;
    requestsPerHour: number;
    activeConnections: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; requests: number }>;
  }> {
    const now = new Date();
    const oneMinuteAgo = subMinutes(now, 1);
    const oneHourAgo = subHours(now, 1);

    // Get recent usage
    const recentUsage = await this.usageLogRepository.find({
      where: {
        timestamp: Between(oneHourAgo, now)
      }
    });

    const lastMinuteUsage = recentUsage.filter(u => u.timestamp >= oneMinuteAgo);
    
    const requestsPerMinute = lastMinuteUsage.length;
    const requestsPerHour = recentUsage.length;
    const averageResponseTime = recentUsage.length > 0 
      ? recentUsage.reduce((sum, u) => sum + u.responseTime, 0) / recentUsage.length 
      : 0;
    const errorRate = recentUsage.length > 0 
      ? (recentUsage.filter(u => u.statusCode >= 400).length / recentUsage.length) * 100 
      : 0;

    // Get active connections from Redis
    const activeConnections = await this.redis.scard('active_connections');

    // Top endpoints in last hour
    const endpointCounts = recentUsage.reduce((acc, u) => {
      acc[u.endpoint] = (acc[u.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, requests]) => ({ endpoint, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    return {
      requestsPerMinute,
      requestsPerHour,
      activeConnections,
      averageResponseTime,
      errorRate,
      topEndpoints
    };
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    period: 'day' | 'week' | 'month' = 'week',
    userId?: string
  ): Promise<{
    daily: Array<{ date: string; requests: number; cost: number; errors: number }>;
    hourly: Array<{ hour: string; requests: number; avgResponseTime: number }>;
  }> {
    const now = new Date();
    const startDate = this.getPeriodStart(period, now);
    const endDate = this.getPeriodEnd(period, now);

    const queryBuilder = this.usageLogRepository
      .createQueryBuilder('usage')
      .where('usage.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (userId) {
      queryBuilder.andWhere('usage.userId = :userId', { userId });
    }

    const usageData = await queryBuilder.getMany();

    // Daily trends
    const dailyTrends = this.aggregateByDay(usageData, startDate, endDate);
    
    // Hourly trends (last 24 hours)
    const hourlyTrends = this.aggregateByHour(usageData, now);

    return {
      daily: dailyTrends,
      hourly: hourlyTrends
    };
  }

  /**
   * Get cost analysis
   */
  async getCostAnalysis(
    period: 'month' | 'quarter' | 'year' = 'month',
    userId?: string
  ): Promise<{
    totalCost: number;
    costByTier: Record<string, number>;
    costByEndpoint: Record<string, number>;
    overageCost: number;
    projectedCost: number;
  }> {
    const now = new Date();
    const startDate = this.getPeriodStart(period, now);
    const endDate = this.getPeriodEnd(period, now);

    const queryBuilder = this.usageLogRepository
      .createQueryBuilder('usage')
      .leftJoin('usage.apiKey', 'apiKey')
      .where('usage.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (userId) {
      queryBuilder.andWhere('usage.userId = :userId', { userId });
    }

    const usageData = await queryBuilder.getMany();

    const totalCost = usageData.reduce((sum, u) => sum + (u.cost || 0), 0);

    // Cost by tier
    const costByTier = usageData.reduce((acc, u) => {
      const tier = (u as any).apiKey?.tier || 'UNKNOWN';
      acc[tier] = (acc[tier] || 0) + (u.cost || 0);
      return acc;
    }, {} as Record<string, number>);

    // Cost by endpoint
    const costByEndpoint = usageData.reduce((acc, u) => {
      acc[u.endpoint] = (acc[u.endpoint] || 0) + (u.cost || 0);
      return acc;
    }, {} as Record<string, number>);

    // Estimate overage cost (simplified)
    const overageCost = totalCost * 0.15; // Assume 15% overage

    // Projected cost for current period
    const daysElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const projectedCost = totalCost * (totalDays / daysElapsed);

    return {
      totalCost,
      costByTier,
      costByEndpoint,
      overageCost,
      projectedCost
    };
  }

  /**
   * Export usage data
   */
  async exportUsageData(
    format: 'csv' | 'json' | 'excel',
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      apiKeyId?: string;
      endpoint?: string;
    } = {}
  ): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    const queryBuilder = this.usageLogRepository
      .createQueryBuilder('usage')
      .leftJoin('usage.apiKey', 'apiKey');

    if (filters.startDate) {
      queryBuilder.andWhere('usage.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('usage.timestamp <= :endDate', { endDate: filters.endDate });
    }

    if (filters.userId) {
      queryBuilder.andWhere('usage.userId = :userId', { userId: filters.userId });
    }

    if (filters.apiKeyId) {
      queryBuilder.andWhere('usage.apiKeyId = :apiKeyId', { apiKeyId: filters.apiKeyId });
    }

    if (filters.endpoint) {
      queryBuilder.andWhere('usage.endpoint LIKE :endpoint', { endpoint: `%${filters.endpoint}%` });
    }

    const usageData = await queryBuilder
      .orderBy('usage.timestamp', 'DESC')
      .limit(10000) // Limit export size
      .getMany();

    const filename = `usage_export_${new Date().toISOString().split('T')[0]}.${format}`;
    const mimeType = this.getMimeType(format);

    let data: any;

    switch (format) {
      case 'json':
        data = JSON.stringify(usageData, null, 2);
        break;
      case 'csv':
        data = this.convertToCSV(usageData);
        break;
      case 'excel':
        data = await this.convertToExcel(usageData);
        break;
    }

    return { data, filename, mimeType };
  }

  /**
   * Get period start date
   */
  private getPeriodStart(period: string, now: Date): Date {
    switch (period) {
      case 'day':
        return startOfDay(now);
      case 'week':
        return startOfDay(subDays(now, 7));
      case 'month':
        return startOfDay(subDays(now, 30));
      case 'year':
        return startOfDay(subDays(now, 365));
      default:
        return startOfDay(now);
    }
  }

  /**
   * Get period end date
   */
  private getPeriodEnd(period: string, now: Date): Date {
    switch (period) {
      case 'day':
        return endOfDay(now);
      case 'week':
        return endOfDay(now);
      case 'month':
        return endOfDay(now);
      case 'year':
        return endOfDay(now);
      default:
        return endOfDay(now);
    }
  }

  /**
   * Get hourly breakdown
   */
  private async getHourlyBreakdown(startDate: Date, endDate: Date): Promise<any[]> {
    const usageData = await this.usageLogRepository
      .createQueryBuilder('usage')
      .where('usage.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const hourlyStats = {};

    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(startDate);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(startDate);
      hourEnd.setHours(hour, 59, 59, 999);

      const hourUsage = usageData.filter(u => 
        u.timestamp >= hourStart && u.timestamp <= hourEnd
      );

      hourlyStats[hour] = {
        hour: hour.toString().padStart(2, '0'),
        requests: hourUsage.length,
        errors: hourUsage.filter(u => u.statusCode >= 400).length,
        avgResponseTime: hourUsage.length > 0 
          ? hourUsage.reduce((sum, u) => sum + u.responseTime, 0) / hourUsage.length 
          : 0
      };
    }

    return Object.values(hourlyStats);
  }

  /**
   * Get API key trends
   */
  private async getApiKeyTrends(apiKeyId: string, period: string): Promise<any> {
    const now = new Date();
    const startDate = this.getPeriodStart(period, now);

    const usageData = await this.usageLogRepository.find({
      where: {
        apiKeyId,
        timestamp: Between(startDate, now)
      },
      order: { timestamp: 'ASC' }
    });

    // Daily trends
    const dailyTrends = this.aggregateByDay(usageData, startDate, now);

    // Hourly trends (last 24 hours)
    const hourlyTrends = this.aggregateByHour(usageData, now);

    return {
      daily: dailyTrends,
      hourly: hourlyTrends
    };
  }

  /**
   * Aggregate usage by day
   */
  private aggregateByDay(usageData: any[], startDate: Date, endDate: Date): any[] {
    const dailyStats = {};

    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayStart = startOfDay(new Date(date));
      const dayEnd = endOfDay(new Date(date));
      const dayKey = dayStart.toISOString().split('T')[0];

      const dayUsage = usageData.filter(u => 
        u.timestamp >= dayStart && u.timestamp <= dayEnd
      );

      dailyStats[dayKey] = {
        date: dayKey,
        requests: dayUsage.length,
        cost: dayUsage.reduce((sum, u) => sum + (u.cost || 0), 0),
        errors: dayUsage.filter(u => u.statusCode >= 400).length
      };
    }

    return Object.values(dailyStats);
  }

  /**
   * Aggregate usage by hour
   */
  private aggregateByHour(usageData: any[], now: Date): any[] {
    const hourlyStats = {};

    for (let hour = 0; hour < 24; hour++) {
      const hourStart = new Date(now);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(now);
      hourEnd.setHours(hour, 59, 59, 999);

      const hourUsage = usageData.filter(u => 
        u.timestamp >= hourStart && u.timestamp <= hourEnd
      );

      hourlyStats[hour] = {
        hour: hour.toString().padStart(2, '0'),
        requests: hourUsage.length,
        avgResponseTime: hourUsage.length > 0 
          ? hourUsage.reduce((sum, u) => sum + u.responseTime, 0) / hourUsage.length 
          : 0
      };
    }

    return Object.values(hourlyStats);
  }

  /**
   * Convert data to CSV
   */
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert data to Excel (placeholder)
   */
  private async convertToExcel(data: any[]): Promise<Buffer> {
    // This would use a library like ExcelJS
    // For now, return CSV as placeholder
    const csv = this.convertToCSV(data);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes = {
      'csv': 'text/csv',
      'json': 'application/json',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[format] || 'application/octet-stream';
  }
}
