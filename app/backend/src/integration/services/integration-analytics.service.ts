import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { IntegrationMetrics, MetricType, MetricPeriod } from '../entities/integration-metrics.entity';
import { Integration } from '../entities/integration.entity';

@Injectable()
export class IntegrationAnalyticsService {
  private readonly logger = new Logger(IntegrationAnalyticsService.name);

  constructor(
    @InjectRepository(IntegrationMetrics)
    private readonly metricsRepository: Repository<IntegrationMetrics>,
  ) {}

  async trackMetric(
    integrationId: string,
    metricType: string,
    value: number,
    dimensions?: Record<string, string>,
    unit?: string,
  ): Promise<void> {
    this.logger.log(`Tracking metric ${metricType} for integration ${integrationId}: ${value}`);

    const metric = this.metricsRepository.create({
      integrationId,
      metricType: metricType as MetricType,
      period: MetricPeriod.MINUTE,
      value,
      dimensions,
      unit,
      timestamp: new Date(),
    });

    await this.metricsRepository.save(metric);
  }

  async getMetrics(
    integrationId: string,
    filters?: {
      metricType?: MetricType;
      period?: MetricPeriod;
      startDate?: Date;
      endDate?: Date;
      dimensions?: Record<string, string>;
    },
  ): Promise<IntegrationMetrics[]> {
    const { metricType, period, startDate, endDate, dimensions } = filters || {};

    const where: any = { integrationId };
    if (metricType) where.metricType = metricType;
    if (period) where.period = period;
    if (startDate && endDate) {
      where.timestamp = Between(startDate, endDate);
    }

    const metrics = await this.metricsRepository.find({
      where,
      order: { timestamp: 'DESC' },
    });

    // Filter by dimensions if provided
    if (dimensions) {
      return metrics.filter(metric => {
        if (!metric.dimensions) return false;
        
        return Object.entries(dimensions).every(([key, value]) => 
          metric.dimensions[key] === value
        );
      });
    }

    return metrics;
  }

  async getAggregatedMetrics(
    integrationId: string,
    metricType: MetricType,
    period: MetricPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    average: number;
    min: number;
    max: number;
    count: number;
  }> {
    const metrics = await this.getMetrics(integrationId, {
      metricType,
      period,
      startDate,
      endDate,
    });

    if (metrics.length === 0) {
      return { total: 0, average: 0, min: 0, max: 0, count: 0 };
    }

    const values = metrics.map(m => m.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      total,
      average,
      min,
      max,
      count: metrics.length,
    };
  }

  async getIntegrationHealthScore(integrationId: string): Promise<{
    overall: number;
    factors: {
      availability: number;
      performance: number;
      errorRate: number;
      successRate: number;
    };
    timestamp: Date;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get metrics for the last hour
    const [apiCalls, responseTimes, errors, successes] = await Promise.all([
      this.getAggregatedMetrics(integrationId, MetricType.API_CALLS, MetricPeriod.MINUTE, oneHourAgo, now),
      this.getAggregatedMetrics(integrationId, MetricType.RESPONSE_TIME, MetricPeriod.MINUTE, oneHourAgo, now),
      this.getAggregatedMetrics(integrationId, MetricType.ERROR_RATE, MetricPeriod.MINUTE, oneHourAgo, now),
      this.getAggregatedMetrics(integrationId, MetricType.SUCCESS_RATE, MetricPeriod.MINUTE, oneHourAgo, now),
    ]);

    // Calculate individual factors
    const availability = apiCalls.count > 0 ? 100 : 0; // Simple availability based on activity
    const performance = responseTimes.average > 0 ? Math.max(0, 100 - (responseTimes.average / 100)) : 100; // Response time score
    const errorRate = errors.count > 0 ? Math.max(0, 100 - (errors.average * 10)) : 100; // Error rate score
    const successRate = successes.count > 0 ? successes.average : 100; // Success rate score

    // Calculate overall health score
    const overall = (availability + performance + errorRate + successRate) / 4;

    return {
      overall: Math.round(overall),
      factors: {
        availability: Math.round(availability),
        performance: Math.round(performance),
        errorRate: Math.round(errorRate),
        successRate: Math.round(successRate),
      },
      timestamp: now,
    };
  }

  async getUsageReport(
    integrationId: string,
    period: 'day' | 'week' | 'month' = 'day',
  ): Promise<{
    period: string;
    totalApiCalls: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
    dataVolume: number;
    webhookDeliveries: number;
    breakdown: {
      date: string;
      apiCalls: number;
      responseTime: number;
      errors: number;
      successes: number;
    }[];
  }> {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
    }

    const [apiCalls, responseTimes, errors, successes, dataVolume, webhookDeliveries] = await Promise.all([
      this.getAggregatedMetrics(integrationId, MetricType.API_CALLS, MetricPeriod.MINUTE, startDate, now),
      this.getAggregatedMetrics(integrationId, MetricType.RESPONSE_TIME, MetricPeriod.MINUTE, startDate, now),
      this.getAggregatedMetrics(integrationId, MetricType.ERROR_RATE, MetricPeriod.MINUTE, startDate, now),
      this.getAggregatedMetrics(integrationId, MetricType.SUCCESS_RATE, MetricPeriod.MINUTE, startDate, now),
      this.getAggregatedMetrics(integrationId, MetricType.DATA_VOLUME, MetricPeriod.MINUTE, startDate, now),
      this.getAggregatedMetrics(integrationId, MetricType.WEBHOOK_DELIVERIES, MetricPeriod.MINUTE, startDate, now),
    ]);

    // Get detailed breakdown
    const breakdown = await this.getDetailedBreakdown(integrationId, startDate, now, groupBy);

    return {
      period,
      totalApiCalls: apiCalls.total,
      averageResponseTime: responseTimes.average,
      errorRate: errors.count > 0 ? (errors.total / apiCalls.total) * 100 : 0,
      successRate: successes.count > 0 ? successes.average : 100,
      dataVolume: dataVolume.total,
      webhookDeliveries: webhookDeliveries.total,
      breakdown,
    };
  }

  async getTopIntegrationsByUsage(limit: number = 10): Promise<{
    integrationId: string;
    totalApiCalls: number;
    averageResponseTime: number;
    errorRate: number;
  }[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Get all integrations with their metrics
    const metrics = await this.metricsRepository
      .createQueryBuilder('metric')
      .select('metric.integrationId', 'integrationId')
      .addSelect('SUM(CASE WHEN metric.metricType = :apiCalls THEN metric.value ELSE 0 END)', 'totalApiCalls')
      .addSelect('AVG(CASE WHEN metric.metricType = :responseTime THEN metric.value ELSE NULL END)', 'averageResponseTime')
      .addSelect('AVG(CASE WHEN metric.metricType = :errorRate THEN metric.value ELSE 0 END)', 'errorRate')
      .where('metric.timestamp BETWEEN :startDate AND :endDate', { startDate: thirtyDaysAgo, endDate: now })
      .groupBy('metric.integrationId')
      .orderBy('totalApiCalls', 'DESC')
      .limit(limit)
      .setParameters({
        apiCalls: MetricType.API_CALLS,
        responseTime: MetricType.RESPONSE_TIME,
        errorRate: MetricType.ERROR_RATE,
      })
      .getRawMany();

    return metrics.map(metric => ({
      integrationId: metric.integrationId,
      totalApiCalls: parseInt(metric.totalApiCalls) || 0,
      averageResponseTime: parseFloat(metric.averageResponseTime) || 0,
      errorRate: parseFloat(metric.errorRate) || 0,
    }));
  }

  async getPerformanceTrends(
    integrationId: string,
    period: 'hour' | 'day' | 'week' = 'day',
    limit: number = 24,
  ): Promise<{
    timestamp: Date;
    apiCalls: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
  }[]> {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - limit * 60 * 60 * 1000);
        groupBy = 'DATE_TRUNC(\'hour\', timestamp)';
        break;
      case 'day':
        startDate = new Date(now.getTime() - limit * 24 * 60 * 60 * 1000);
        groupBy = 'DATE_TRUNC(\'day\', timestamp)';
        break;
      case 'week':
        startDate = new Date(now.getTime() - limit * 7 * 24 * 60 * 60 * 1000);
        groupBy = 'DATE_TRUNC(\'week\', timestamp)';
        break;
    }

    const trends = await this.metricsRepository
      .createQueryBuilder('metric')
      .select(groupBy, 'timestamp')
      .addSelect('SUM(CASE WHEN metric.metricType = :apiCalls THEN metric.value ELSE 0 END)', 'apiCalls')
      .addSelect('AVG(CASE WHEN metric.metricType = :responseTime THEN metric.value ELSE NULL END)', 'averageResponseTime')
      .addSelect('AVG(CASE WHEN metric.metricType = :errorRate THEN metric.value ELSE 0 END)', 'errorRate')
      .addSelect('AVG(CASE WHEN metric.metricType = :successRate THEN metric.value ELSE 100 END)', 'successRate')
      .where('metric.integrationId = :integrationId', { integrationId })
      .andWhere('metric.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate: now })
      .groupBy(groupBy)
      .orderBy('timestamp', 'ASC')
      .setParameters({
        apiCalls: MetricType.API_CALLS,
        responseTime: MetricType.RESPONSE_TIME,
        errorRate: MetricType.ERROR_RATE,
        successRate: MetricType.SUCCESS_RATE,
      })
      .getRawMany();

    return trends.map(trend => ({
      timestamp: new Date(trend.timestamp),
      apiCalls: parseInt(trend.apiCalls) || 0,
      averageResponseTime: parseFloat(trend.averageResponseTime) || 0,
      errorRate: parseFloat(trend.errorRate) || 0,
      successRate: parseFloat(trend.successRate) || 100,
    }));
  }

  async generateAnalyticsReport(integrationId?: string): Promise<{
    generatedAt: Date;
    summary: {
      totalIntegrations: number;
      activeIntegrations: number;
      totalApiCalls: number;
      averageResponseTime: number;
      overallErrorRate: number;
      overallSuccessRate: number;
    };
    topPerformers: {
      integrationId: string;
      healthScore: number;
      usage: number;
    }[];
    trends: {
      period: string;
      apiCalls: number;
      responseTime: number;
      errorRate: number;
    }[];
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    // Get summary statistics
    const [totalIntegrations, activeIntegrations, totalApiCalls, avgResponseTime, errorRate, successRate] = await Promise.all([
      this.getTotalIntegrationsCount(),
      this.getActiveIntegrationsCount(),
      this.getTotalApiCalls(thirtyDaysAgo, now, integrationId),
      this.getAverageResponseTime(thirtyDaysAgo, now, integrationId),
      this.getErrorRate(thirtyDaysAgo, now, integrationId),
      this.getSuccessRate(thirtyDaysAgo, now, integrationId),
    ]);

    // Get top performers
    const topPerformers = await this.getTopIntegrationsByUsage(5);

    // Get recent trends
    const trends = await this.getPerformanceTrends(integrationId || '', 'day', 7);

    return {
      generatedAt: now,
      summary: {
        totalIntegrations,
        activeIntegrations,
        totalApiCalls,
        averageResponseTime: avgResponseTime,
        overallErrorRate: errorRate,
        overallSuccessRate: successRate,
      },
      topPerformers: topPerformers.map(performer => ({
        integrationId: performer.integrationId,
        healthScore: Math.max(0, 100 - performer.errorRate * 10 - (performer.averageResponseTime / 100)),
        usage: performer.totalApiCalls,
      })),
      trends: trends.map(trend => ({
        period: trend.timestamp.toISOString().split('T')[0],
        apiCalls: trend.apiCalls,
        responseTime: trend.averageResponseTime,
        errorRate: trend.errorRate,
      })),
    };
  }

  async cleanupOldMetrics(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.metricsRepository.delete({
      timestamp: { $lt: cutoffDate } as any,
    });

    this.logger.log(`Cleaned up ${result.affected} old metrics records`);
    return result.affected || 0;
  }

  private async getTotalIntegrationsCount(): Promise<number> {
    // This would query the integration repository
    // For now, return a mock value
    return 10;
  }

  private async getActiveIntegrationsCount(): Promise<number> {
    // This would query active integrations
    // For now, return a mock value
    return 7;
  }

  private async getTotalApiCalls(startDate: Date, endDate: Date, integrationId?: string): Promise<number> {
    const where: any = {
      metricType: MetricType.API_CALLS,
      timestamp: Between(startDate, endDate),
    };

    if (integrationId) {
      where.integrationId = integrationId;
    }

    const result = await this.metricsRepository.find({ where });
    return result.reduce((sum, metric) => sum + metric.value, 0);
  }

  private async getAverageResponseTime(startDate: Date, endDate: Date, integrationId?: string): Promise<number> {
    const where: any = {
      metricType: MetricType.RESPONSE_TIME,
      timestamp: Between(startDate, endDate),
    };

    if (integrationId) {
      where.integrationId = integrationId;
    }

    const result = await this.metricsRepository.find({ where });
    if (result.length === 0) return 0;

    const total = result.reduce((sum, metric) => sum + metric.value, 0);
    return total / result.length;
  }

  private async getErrorRate(startDate: Date, endDate: Date, integrationId?: string): Promise<number> {
    const where: any = {
      metricType: MetricType.ERROR_RATE,
      timestamp: Between(startDate, endDate),
    };

    if (integrationId) {
      where.integrationId = integrationId;
    }

    const result = await this.metricsRepository.find({ where });
    if (result.length === 0) return 0;

    const total = result.reduce((sum, metric) => sum + metric.value, 0);
    return total / result.length;
  }

  private async getSuccessRate(startDate: Date, endDate: Date, integrationId?: string): Promise<number> {
    const where: any = {
      metricType: MetricType.SUCCESS_RATE,
      timestamp: Between(startDate, endDate),
    };

    if (integrationId) {
      where.integrationId = integrationId;
    }

    const result = await this.metricsRepository.find({ where });
    if (result.length === 0) return 100;

    const total = result.reduce((sum, metric) => sum + metric.value, 0);
    return total / result.length;
  }

  private async getDetailedBreakdown(
    integrationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: string,
  ): Promise<any[]> {
    // This would implement detailed breakdown by time periods
    // For now, return mock data
    return [
      {
        date: startDate.toISOString().split('T')[0],
        apiCalls: 100,
        responseTime: 250,
        errors: 5,
        successes: 95,
      },
    ];
  }
}
