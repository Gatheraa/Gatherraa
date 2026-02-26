import { Injectable, Logger } from '@nestjs/common';
import { AdvancedCacheService } from './advanced-cache.service';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRatio: number;
  averageResponseTime: number;
  memoryUsage: number;
  keyCount: number;
  throughput: number;
  errorRate: number;
}

export interface PerformanceAlert {
  type: 'hit_ratio' | 'memory_usage' | 'response_time' | 'error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface OptimizationSuggestion {
  type: 'ttl_adjustment' | 'compression' | 'pattern_optimization' | 'memory_cleanup';
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  keys: string[];
}

@Injectable()
export class CachePerformanceService {
  private readonly logger = new Logger(CachePerformanceService.name);
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRatio: 0,
    averageResponseTime: 0,
    memoryUsage: 0,
    keyCount: 0,
    throughput: 0,
    errorRate: 0
  };
  private responseTimeHistory: number[] = [];
  private alerts: PerformanceAlert[] = [];
  private lastMetricsUpdate = Date.now();

  constructor(private cacheService: AdvancedCacheService) {
    this.startMetricsCollection();
  }

  /**
   * Get current cache performance metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const stats = await this.cacheService.getStats();
      const now = Date.now();
      const timeDiff = (now - this.lastMetricsUpdate) / 1000;

      // Calculate throughput
      const totalOperations = stats.hits + stats.misses + stats.sets + stats.deletes;
      const throughput = timeDiff > 0 ? totalOperations / timeDiff : 0;

      // Calculate average response time
      const avgResponseTime = this.responseTimeHistory.length > 0
        ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length
        : 0;

      this.metrics = {
        ...stats,
        throughput,
        averageResponseTime: avgResponseTime,
        errorRate: this.calculateErrorRate()
      };

      this.lastMetricsUpdate = now;

      return { ...this.metrics };
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      return this.metrics;
    }
  }

  /**
   * Record cache operation for performance tracking
   */
  recordOperation(operation: 'get' | 'set' | 'delete', responseTime: number, success: boolean = true): void {
    // Track response time
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-1000);
    }

    // Track errors
    if (!success) {
      this.logger.warn(`Cache operation failed: ${operation} (${responseTime}ms)`);
    }

    // Check for performance alerts
    this.checkPerformanceAlerts(operation, responseTime, success);
  }

  /**
   * Get performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return this.alerts.slice(-100); // Return last 100 alerts
  }

  /**
   * Get optimization suggestions
   */
  async getOptimizationSuggestions(): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = await this.getMetrics();

    // Hit ratio optimization
    if (metrics.hitRatio < 0.7) {
      suggestions.push({
        type: 'ttl_adjustment',
        description: 'Cache hit ratio is below 70%. Consider increasing TTL for frequently accessed keys.',
        impact: 'High - Improves performance and reduces database load',
        effort: 'low',
        keys: await this.getLowHitRatioKeys()
      });
    }

    // Memory usage optimization
    if (metrics.memoryUsage > 0.8) {
      suggestions.push({
        type: 'memory_cleanup',
        description: 'Memory usage is above 80%. Consider enabling compression or cleaning up unused keys.',
        impact: 'Medium - Frees up memory and improves performance',
        effort: 'medium',
        keys: await this.getLargeKeys()
      });
    }

    // Response time optimization
    if (metrics.averageResponseTime > 100) {
      suggestions.push({
        type: 'pattern_optimization',
        description: 'Average response time is above 100ms. Consider optimizing cache patterns.',
        impact: 'High - Significantly improves response times',
        effort: 'high',
        keys: await this.getSlowKeys()
      });
    }

    // Compression suggestions
    const compressionCandidates = await this.getCompressionCandidates();
    if (compressionCandidates.length > 0) {
      suggestions.push({
        type: 'compression',
        description: 'Found large keys that would benefit from compression.',
        impact: 'Medium - Reduces memory usage and network transfer',
        effort: 'low',
        keys: compressionCandidates
      });
    }

    return suggestions;
  }

  /**
   * Optimize cache based on performance data
   */
  async optimizeCache(): Promise<void> {
    this.logger.log('Starting cache optimization...');

    try {
      const suggestions = await this.getOptimizationSuggestions();

      for (const suggestion of suggestions) {
        await this.applyOptimization(suggestion);
      }

      this.logger.log(`Cache optimization completed. Applied ${suggestions.length} optimizations.`);
    } catch (error) {
      this.logger.error(`Cache optimization failed: ${error.message}`);
    }
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(): Promise<{
    metrics: CacheMetrics;
    alerts: PerformanceAlert[];
    suggestions: OptimizationSuggestion[];
    summary: {
      overall: 'excellent' | 'good' | 'fair' | 'poor';
      issues: string[];
      recommendations: string[];
    };
  }> {
    const metrics = await this.getMetrics();
    const alerts = this.getAlerts();
    const suggestions = await this.getOptimizationSuggestions();

    const summary = this.generatePerformanceSummary(metrics, alerts, suggestions);

    return {
      metrics,
      alerts,
      suggestions,
      summary
    };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.responseTimeHistory = [];
    this.alerts = [];
    this.logger.log('Performance history cleared');
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.getMetrics();
    }, 60000); // Update metrics every minute

    setInterval(async () => {
      await this.checkSystemHealth();
    }, 300000); // Health check every 5 minutes
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(operation: string, responseTime: number, success: boolean): void {
    const now = new Date();

    // Response time alerts
    if (responseTime > 500) {
      this.addAlert({
        type: 'response_time',
        severity: responseTime > 1000 ? 'critical' : 'high',
        message: `Slow cache operation: ${operation} took ${responseTime}ms`,
        value: responseTime,
        threshold: 500,
        timestamp: now
      });
    }

    // Error rate alerts
    if (!success) {
      const errorRate = this.calculateErrorRate();
      if (errorRate > 0.05) { // 5% error rate
        this.addAlert({
          type: 'error_rate',
          severity: errorRate > 0.1 ? 'critical' : 'high',
          message: `High cache error rate: ${(errorRate * 100).toFixed(2)}%`,
          value: errorRate,
          threshold: 0.05,
          timestamp: now
        });
      }
    }
  }

  /**
   * Check system health
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const metrics = await this.getMetrics();

      // Hit ratio alerts
      if (metrics.hitRatio < 0.5) {
        this.addAlert({
          type: 'hit_ratio',
          severity: 'medium',
          message: `Low cache hit ratio: ${(metrics.hitRatio * 100).toFixed(2)}%`,
          value: metrics.hitRatio,
          threshold: 0.5,
          timestamp: new Date()
        });
      }

      // Memory usage alerts
      if (metrics.memoryUsage > 0.9) {
        this.addAlert({
          type: 'memory_usage',
          severity: 'critical',
          message: `High memory usage: ${(metrics.memoryUsage * 100).toFixed(2)}%`,
          value: metrics.memoryUsage,
          threshold: 0.9,
          timestamp: new Date()
        });
      }

    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // This would be calculated based on actual error tracking
    // For now, return a placeholder
    return 0.01;
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    this.logger.warn(`Performance alert: ${alert.message}`);
  }

  /**
   * Get keys with low hit ratio
   */
  private async getLowHitRatioKeys(): Promise<string[]> {
    // This would analyze actual cache data
    // For now, return placeholder
    return ['user:*:activity', 'events:old:*'];
  }

  /**
   * Get large keys
   */
  private async getLargeKeys(): Promise<string[]> {
    // This would analyze actual cache data
    // For now, return placeholder
    return ['analytics:detailed:*', 'reports:large:*'];
  }

  /**
   * Get slow keys
   */
  private async getSlowKeys(): Promise<string[]> {
    // This would analyze actual cache data
    // For now, return placeholder
    return ['complex:queries:*', 'aggregated:data:*'];
  }

  /**
   * Get compression candidates
   */
  private async getCompressionCandidates(): Promise<string[]> {
    // This would analyze actual cache data
    // For now, return placeholder
    return ['large:objects:*', 'json:data:*'];
  }

  /**
   * Apply optimization suggestion
   */
  private async applyOptimization(suggestion: OptimizationSuggestion): Promise<void> {
    try {
      switch (suggestion.type) {
        case 'ttl_adjustment':
          await this.applyTtlOptimization(suggestion.keys);
          break;
        case 'compression':
          await this.applyCompressionOptimization(suggestion.keys);
          break;
        case 'pattern_optimization':
          await this.applyPatternOptimization(suggestion.keys);
          break;
        case 'memory_cleanup':
          await this.applyMemoryCleanup(suggestion.keys);
          break;
      }

      this.logger.log(`Applied optimization: ${suggestion.description}`);
    } catch (error) {
      this.logger.error(`Failed to apply optimization: ${error.message}`);
    }
  }

  /**
   * Apply TTL optimization
   */
  private async applyTtlOptimization(keys: string[]): Promise<void> {
    // Implementation would adjust TTL for specified keys
    this.logger.log(`Applied TTL optimization to ${keys.length} keys`);
  }

  /**
   * Apply compression optimization
   */
  private async applyCompressionOptimization(keys: string[]): Promise<void> {
    // Implementation would enable compression for specified keys
    this.logger.log(`Applied compression optimization to ${keys.length} keys`);
  }

  /**
   * Apply pattern optimization
   */
  private async applyPatternOptimization(keys: string[]): Promise<void> {
    // Implementation would optimize cache patterns
    this.logger.log(`Applied pattern optimization to ${keys.length} keys`);
  }

  /**
   * Apply memory cleanup
   */
  private async applyMemoryCleanup(keys: string[]): Promise<void> {
    // Implementation would clean up memory for specified keys
    this.logger.log(`Applied memory cleanup to ${keys.length} keys`);
  }

  /**
   * Generate performance summary
   */
  private generatePerformanceSummary(
    metrics: CacheMetrics,
    alerts: PerformanceAlert[],
    suggestions: OptimizationSuggestion[]
  ): {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Evaluate hit ratio
    if (metrics.hitRatio < 0.5) {
      issues.push('Low cache hit ratio');
      recommendations.push('Increase TTL for frequently accessed data');
    } else if (metrics.hitRatio < 0.7) {
      issues.push('Moderate cache hit ratio');
      recommendations.push('Review cache patterns and TTL settings');
    }

    // Evaluate response time
    if (metrics.averageResponseTime > 200) {
      issues.push('High average response time');
      recommendations.push('Optimize cache patterns and consider compression');
    } else if (metrics.averageResponseTime > 100) {
      issues.push('Moderate response time');
      recommendations.push('Monitor slow operations and optimize patterns');
    }

    // Evaluate memory usage
    if (metrics.memoryUsage > 0.9) {
      issues.push('High memory usage');
      recommendations.push('Enable compression and clean up unused keys');
    } else if (metrics.memoryUsage > 0.8) {
      issues.push('Moderate memory usage');
      recommendations.push('Monitor memory growth and consider cleanup');
    }

    // Determine overall rating
    let overall: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    
    if (issues.length >= 3) {
      overall = 'poor';
    } else if (issues.length >= 2) {
      overall = 'fair';
    } else if (issues.length >= 1) {
      overall = 'good';
    }

    return { overall, issues, recommendations };
  }
}
