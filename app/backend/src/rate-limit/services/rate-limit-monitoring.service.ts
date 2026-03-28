import { Injectable, Logger } from '@nestjs/common';
import { RateLimitResult } from '../rate-limit.service';

export interface RateLimitViolationLog {
  userId?: string;
  ip: string;
  endpoint: string;
  userAgent: string;
  timestamp: Date;
  retryAfter: number;
  tier?: string;
  limit: number;
  windowMs: number;
}

@Injectable()
export class RateLimitMonitoringService {
  private readonly logger = new Logger(RateLimitMonitoringService.name);
  private readonly violationLogs: RateLimitViolationLog[] = [];
  private readonly maxLogSize = 10000; // Keep last 10k violations

  async logRateLimitViolation(
    userId: string | undefined,
    ip: string,
    endpoint: string,
    userAgent: string,
    result: RateLimitResult,
    tier?: string,
    config?: any,
  ): Promise<void> {
    const violation: RateLimitViolationLog = {
      userId,
      ip,
      endpoint,
      userAgent: userAgent || 'unknown',
      timestamp: new Date(),
      retryAfter: result.retryAfter,
      tier,
      limit: config?.limit || result.limit,
      windowMs: config?.windowMs || 60000,
    };

    // Add to in-memory log
    this.violationLogs.push(violation);
    
    // Trim log if it gets too large
    if (this.violationLogs.length > this.maxLogSize) {
      this.violationLogs.splice(0, this.violationLogs.length - this.maxLogSize);
    }

    // Log to NestJS logger
    this.logger.warn(`Rate limit violation: ${JSON.stringify(violation)}`);

    // Send to external monitoring systems
    await this.sendToMonitoringSystems(violation);
  }

  async sendToMonitoringSystems(violation: RateLimitViolationLog): Promise<void> {
    // Integration with various monitoring systems
    try {
      // Send to Elasticsearch (if configured)
      await this.sendToElasticsearch(violation);
      
      // Send to Sentry (if configured)
      await this.sendToSentry(violation);
      
      // Send to custom analytics
      await this.sendToAnalytics(violation);
    } catch (error) {
      this.logger.error('Failed to send violation to monitoring systems:', error);
    }
  }

  private async sendToElasticsearch(violation: RateLimitViolationLog): Promise<void> {
    // Implementation would depend on your Elasticsearch setup
    // This is a placeholder for the actual implementation
    this.logger.debug(`Would send to Elasticsearch: ${violation.ip} - ${violation.endpoint}`);
  }

  private async sendToSentry(violation: RateLimitViolationLog): Promise<void> {
    // Implementation would use the Sentry SDK
    // This is a placeholder for the actual implementation
    this.logger.debug(`Would send to Sentry: ${violation.ip} - ${violation.endpoint}`);
  }

  private async sendToAnalytics(violation: RateLimitViolationLog): Promise<void> {
    // Implementation would send to your analytics service
    // This is a placeholder for the actual implementation
    this.logger.debug(`Would send to Analytics: ${violation.ip} - ${violation.endpoint}`);
  }

  getViolationStats(timeWindowMs: number = 3600000): any {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMs);
    
    const recentViolations = this.violationLogs.filter(
      log => log.timestamp >= windowStart
    );

    return {
      totalViolations: recentViolations.length,
      uniqueIps: new Set(recentViolations.map(v => v.ip)).size,
      uniqueUsers: new Set(recentViolations.map(v => v.userId).filter(Boolean)).size,
      topEndpoints: this.getTopEndpoints(recentViolations),
      topIps: this.getTopIps(recentViolations),
      violationsByTier: this.getViolationsByTier(recentViolations),
    };
  }

  private getTopEndpoints(violations: RateLimitViolationLog[], limit: number = 10): Array<{endpoint: string, count: number}> {
    const counts = violations.reduce((acc, v) => {
      acc[v.endpoint] = (acc[v.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getTopIps(violations: RateLimitViolationLog[], limit: number = 10): Array<{ip: string, count: number}> {
    const counts = violations.reduce((acc, v) => {
      acc[v.ip] = (acc[v.ip] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getViolationsByTier(violations: RateLimitViolationLog[]): Record<string, number> {
    return violations.reduce((acc, v) => {
      const tier = v.tier || 'UNKNOWN';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  async detectSuspiciousPatterns(timeWindowMs: number = 300000): Promise<Array<{type: string, description: string}>> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindowMs);
    
    const recentViolations = this.violationLogs.filter(
      log => log.timestamp >= windowStart
    );

    const patterns = [];

    // Detect high-frequency violations from single IP
    const ipCounts = this.getTopIps(recentViolations, 1);
    if (ipCounts.length > 0 && ipCounts[0].count > 50) {
      patterns.push({
        type: 'HIGH_FREQUENCY_IP',
        description: `IP ${ipCounts[0].ip} has ${ipCounts[0].count} violations in last 5 minutes`
      });
    }

    // Detect distributed attack pattern
    const uniqueIps = new Set(recentViolations.map(v => v.ip)).size;
    if (uniqueIps > 100 && recentViolations.length > 500) {
      patterns.push({
        type: 'DISTRIBUTED_ATTACK',
        description: `${uniqueIps} unique IPs with ${recentViolations.length} total violations`
      });
    }

    // Detect endpoint-specific abuse
    const endpointCounts = this.getTopEndpoints(recentViolations, 1);
    if (endpointCounts.length > 0 && endpointCounts[0].count > 100) {
      patterns.push({
        type: 'ENDPOINT_ABUSE',
        description: `Endpoint ${endpointCounts[0].endpoint} has ${endpointCounts[0].count} violations`
      });
    }

    return patterns;
  }
}
