import { Injectable, Logger } from '@nestjs/common';
import { AdvancedCacheService } from './advanced-cache.service';
import { CachePerformanceService } from './cache-performance.service';

export interface CacheAnalytics {
  hitRatio: number;
  missRatio: number;
  averageResponseTime: number;
  throughput: number;
  memoryUsage: number;
  keyCount: number;
  errorRate: number;
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
    lastAccessed: Date;
  }>;
  patterns: Array<{
    pattern: string;
    keyCount: number;
    hitRatio: number;
    totalSize: number;
  }>;
  timeSeries: Array<{
    timestamp: Date;
    hits: number;
    misses: number;
    responseTime: number;
  }>;
}

export interface CacheInsight {
  type: 'performance' | 'usage' | 'optimization' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  impact: string;
  metrics: Record<string, number>;
}

@Injectable()
export class CacheAnalyticsService {
  private readonly logger = new Logger(CacheAnalyticsService.name);
  private analyticsData: CacheAnalytics;
  private insights: CacheInsight[] = [];
  private timeSeriesData: any[] = [];

  constructor(
    private cacheService: AdvancedCacheService,
    private performanceService: CachePerformanceService,
  ) {
    this.initializeAnalytics();
    this.startAnalyticsCollection();
  }

  /**
   * Get comprehensive cache analytics
   */
  async getAnalytics(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<CacheAnalytics> {
    try {
      const metrics = await this.performanceService.getMetrics();
      const topKeys = await this.getTopKeys();
      const patterns = await this.getPatternAnalytics();
      const timeSeries = this.getTimeSeriesData(timeRange);

      this.analyticsData = {
        hitRatio: metrics.hitRatio,
        missRatio: 1 - metrics.hitRatio,
        averageResponseTime: metrics.averageResponseTime,
        throughput: metrics.throughput,
        memoryUsage: metrics.memoryUsage,
        keyCount: metrics.keyCount,
        errorRate: metrics.errorRate,
        topKeys,
        patterns,
        timeSeries
      };

      return { ...this.analyticsData };
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cache insights and recommendations
   */
  async getInsights(): Promise<CacheInsight[]> {
    const analytics = await this.getAnalytics();
    const insights: CacheInsight[] = [];

    // Performance insights
    insights.push(...this.generatePerformanceInsights(analytics));

    // Usage insights
    insights.push(...this.generateUsageInsights(analytics));

    // Optimization insights
    insights.push(...this.generateOptimizationInsights(analytics));

    // Anomaly detection
    insights.push(...this.detectAnomalies(analytics));

    // Sort by severity and limit to top 20
    return insights
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
      .slice(0, 20);
  }

  /**
   * Get hit ratio by key pattern
   */
  async getHitRatioByPattern(patterns: string[]): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const pattern of patterns) {
      try {
        const keys = await this.cacheService.getKeysByPattern(pattern);
        let totalHits = 0;
        let totalRequests = 0;

        for (const key of keys) {
          const stats = await this.cacheService.getKeyStats(key);
          totalHits += stats.hits;
          totalRequests += stats.hits + stats.misses;
        }

        results[pattern] = totalRequests > 0 ? totalHits / totalRequests : 0;
      } catch (error) {
        this.logger.error(`Failed to get hit ratio for pattern ${pattern}: ${error.message}`);
        results[pattern] = 0;
      }
    }

    return results;
  }

  /**
   * Get cache efficiency report
   */
  async getEfficiencyReport(): Promise<{
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    score: number;
    breakdown: {
      hitRatio: { score: number; weight: number };
      responseTime: { score: number; weight: number };
      memoryUsage: { score: number; weight: number };
      throughput: { score: number; weight: number };
    };
    recommendations: string[];
  }> {
    const analytics = await this.getAnalytics();

    // Calculate individual scores (0-100)
    const hitRatioScore = Math.min(analytics.hitRatio * 100, 100);
    const responseTimeScore = Math.max(0, 100 - (analytics.averageResponseTime / 10));
    const memoryUsageScore = Math.max(0, 100 - (analytics.memoryUsage * 100));
    const throughputScore = Math.min(analytics.throughput / 10, 100);

    // Weighted overall score
    const weights = { hitRatio: 0.4, responseTime: 0.3, memoryUsage: 0.2, throughput: 0.1 };
    const overallScore = 
      hitRatioScore * weights.hitRatio +
      responseTimeScore * weights.responseTime +
      memoryUsageScore * weights.memoryUsage +
      throughputScore * weights.throughput;

    // Determine overall rating
    let overall: 'excellent' | 'good' | 'fair' | 'poor';
    if (overallScore >= 90) overall = 'excellent';
    else if (overallScore >= 75) overall = 'good';
    else if (overallScore >= 60) overall = 'fair';
    else overall = 'poor';

    // Generate recommendations
    const recommendations = this.generateEfficiencyRecommendations(analytics);

    return {
      overall,
      score: Math.round(overallScore),
      breakdown: {
        hitRatio: { score: Math.round(hitRatioScore), weight: weights.hitRatio },
        responseTime: { score: Math.round(responseTimeScore), weight: weights.responseTime },
        memoryUsage: { score: Math.round(memoryUsageScore), weight: weights.memoryUsage },
        throughput: { score: Math.round(throughputScore), weight: weights.throughput }
      },
      recommendations
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(format: 'json' | 'csv' | 'excel' = 'json'): Promise<{
    data: any;
    filename: string;
    mimeType: string;
  }> {
    const analytics = await this.getAnalytics();
    const insights = await this.getInsights();
    const efficiency = await this.getEfficiencyReport();

    const exportData = {
      timestamp: new Date(),
      analytics,
      insights,
      efficiency,
      metadata: {
        version: '1.0.0',
        generatedBy: 'CacheAnalyticsService'
      }
    };

    const filename = `cache-analytics-${new Date().toISOString().split('T')[0]}.${format}`;
    const mimeType = this.getMimeType(format);

    let data: any;
    switch (format) {
      case 'json':
        data = JSON.stringify(exportData, null, 2);
        break;
      case 'csv':
        data = this.convertToCSV(exportData);
        break;
      case 'excel':
        data = await this.convertToExcel(exportData);
        break;
    }

    return { data, filename, mimeType };
  }

  /**
   * Initialize analytics
   */
  private initializeAnalytics(): void {
    this.analyticsData = {
      hitRatio: 0,
      missRatio: 1,
      averageResponseTime: 0,
      throughput: 0,
      memoryUsage: 0,
      keyCount: 0,
      errorRate: 0,
      topKeys: [],
      patterns: [],
      timeSeries: []
    };
  }

  /**
   * Start analytics collection
   */
  private startAnalyticsCollection(): void {
    // Collect data every minute
    setInterval(async () => {
      await this.collectAnalyticsData();
    }, 60000);

    // Generate insights every 5 minutes
    setInterval(async () => {
      await this.generateInsights();
    }, 300000);
  }

  /**
   * Collect analytics data
   */
  private async collectAnalyticsData(): Promise<void> {
    try {
      const metrics = await this.performanceService.getMetrics();
      
      const dataPoint = {
        timestamp: new Date(),
        hits: metrics.hits,
        misses: metrics.misses,
        responseTime: metrics.averageResponseTime,
        memoryUsage: metrics.memoryUsage,
        keyCount: metrics.keyCount
      };

      this.timeSeriesData.push(dataPoint);
      
      // Keep only last 24 hours of data
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.timeSeriesData = this.timeSeriesData.filter(point => point.timestamp > cutoff);

    } catch (error) {
      this.logger.error(`Failed to collect analytics data: ${error.message}`);
    }
  }

  /**
   * Get top keys
   */
  private async getTopKeys(): Promise<any[]> {
    // This would analyze actual cache data
    // For now, return placeholder data
    return [
      { key: 'user:12345', hits: 1500, size: 2048, lastAccessed: new Date() },
      { key: 'events:popular', hits: 1200, size: 4096, lastAccessed: new Date() },
      { key: 'categories:all', hits: 800, size: 1024, lastAccessed: new Date() }
    ];
  }

  /**
   * Get pattern analytics
   */
  private async getPatternAnalytics(): Promise<any[]> {
    // This would analyze actual cache patterns
    // For now, return placeholder data
    return [
      { pattern: 'user:*', keyCount: 150, hitRatio: 0.85, totalSize: 204800 },
      { pattern: 'event:*', keyCount: 200, hitRatio: 0.78, totalSize: 512000 },
      { pattern: 'category:*', keyCount: 50, hitRatio: 0.92, totalSize: 51200 }
    ];
  }

  /**
   * Get time series data
   */
  private getTimeSeriesData(timeRange: string): any[] {
    const now = new Date();
    let dataPoints: any[] = [];

    switch (timeRange) {
      case 'hour':
        dataPoints = this.timeSeriesData.slice(-60); // Last 60 minutes
        break;
      case 'day':
        dataPoints = this.timeSeriesData.slice(-144); // Last 24 hours (every 10 minutes)
        break;
      case 'week':
        dataPoints = this.timeSeriesData.slice(-168); // Last 7 days (every hour)
        break;
      case 'month':
        dataPoints = this.timeSeriesData.slice(-30); // Last 30 days (every day)
        break;
    }

    return dataPoints;
  }

  /**
   * Generate performance insights
   */
  private generatePerformanceInsights(analytics: CacheAnalytics): CacheInsight[] {
    const insights: CacheInsight[] = [];

    // Hit ratio insights
    if (analytics.hitRatio < 0.5) {
      insights.push({
        type: 'performance',
        severity: 'high',
        title: 'Low Cache Hit Ratio',
        description: `Cache hit ratio is ${(analytics.hitRatio * 100).toFixed(2)}%, which is below optimal levels.`,
        recommendation: 'Review cache patterns, increase TTL for frequently accessed data, and implement cache warming.',
        impact: 'High - Significant database load and slow response times',
        metrics: { hitRatio: analytics.hitRatio }
      });
    }

    // Response time insights
    if (analytics.averageResponseTime > 200) {
      insights.push({
        type: 'performance',
        severity: 'medium',
        title: 'High Average Response Time',
        description: `Average cache response time is ${analytics.averageResponseTime.toFixed(2)}ms.`,
        recommendation: 'Optimize cache patterns, enable compression, and consider memory cache optimization.',
        impact: 'Medium - Slower application response times',
        metrics: { averageResponseTime: analytics.averageResponseTime }
      });
    }

    return insights;
  }

  /**
   * Generate usage insights
   */
  private generateUsageInsights(analytics: CacheAnalytics): CacheInsight[] {
    const insights: CacheInsight[] = [];

    // Memory usage insights
    if (analytics.memoryUsage > 0.8) {
      insights.push({
        type: 'usage',
        severity: 'critical',
        title: 'High Memory Usage',
        description: `Cache memory usage is ${(analytics.memoryUsage * 100).toFixed(2)}%.`,
        recommendation: 'Enable compression, clean up unused keys, and consider increasing memory allocation.',
        impact: 'Critical - Risk of cache eviction and performance degradation',
        metrics: { memoryUsage: analytics.memoryUsage }
      });
    }

    // Key count insights
    if (analytics.keyCount > 100000) {
      insights.push({
        type: 'usage',
        severity: 'medium',
        title: 'High Key Count',
        description: `Cache contains ${analytics.keyCount.toLocaleString()} keys.`,
        recommendation: 'Review cache patterns and implement key expiration strategies.',
        impact: 'Medium - Increased memory usage and slower operations',
        metrics: { keyCount: analytics.keyCount }
      });
    }

    return insights;
  }

  /**
   * Generate optimization insights
   */
  private generateOptimizationInsights(analytics: CacheAnalytics): CacheInsight[] {
    const insights: CacheInsight[] = [];

    // Identify patterns with low hit ratios
    const lowHitPatterns = analytics.patterns.filter(p => p.hitRatio < 0.6);
    if (lowHitPatterns.length > 0) {
      insights.push({
        type: 'optimization',
        severity: 'medium',
        title: 'Low Hit Ratio Patterns',
        description: `Found ${lowHitPatterns.length} cache patterns with hit ratios below 60%.`,
        recommendation: 'Review TTL settings and access patterns for these cache keys.',
        impact: 'Medium - Wasted memory and reduced performance',
        metrics: { lowHitPatterns: lowHitPatterns.length }
      });
    }

    return insights;
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(analytics: CacheAnalytics): CacheInsight[] {
    const insights: CacheInsight[] = [];

    // Error rate anomaly
    if (analytics.errorRate > 0.05) {
      insights.push({
        type: 'anomaly',
        severity: 'high',
        title: 'High Error Rate',
        description: `Cache error rate is ${(analytics.errorRate * 100).toFixed(2)}%.`,
        recommendation: 'Investigate cache connectivity and configuration issues.',
        impact: 'High - Cache failures affecting application performance',
        metrics: { errorRate: analytics.errorRate }
      });
    }

    return insights;
  }

  /**
   * Generate efficiency recommendations
   */
  private generateEfficiencyRecommendations(analytics: CacheAnalytics): string[] {
    const recommendations: string[] = [];

    if (analytics.hitRatio < 0.7) {
      recommendations.push('Increase TTL for frequently accessed data');
      recommendations.push('Implement cache warming strategies');
    }

    if (analytics.averageResponseTime > 100) {
      recommendations.push('Enable compression for large objects');
      recommendations.push('Optimize cache patterns and queries');
    }

    if (analytics.memoryUsage > 0.8) {
      recommendations.push('Clean up expired and unused cache entries');
      recommendations.push('Enable compression to reduce memory usage');
    }

    return recommendations;
  }

  /**
   * Get severity weight for sorting
   */
  private getSeverityWeight(severity: string): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 };
    return weights[severity] || 0;
  }

  /**
   * Convert data to CSV
   */
  private convertToCSV(data: any): string {
    // Simplified CSV conversion
    return JSON.stringify(data);
  }

  /**
   * Convert data to Excel
   */
  private async convertToExcel(data: any): Promise<Buffer> {
    // Placeholder for Excel conversion
    return Buffer.from(JSON.stringify(data));
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: string): string {
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return mimeTypes[format] || 'application/octet-stream';
  }
}
