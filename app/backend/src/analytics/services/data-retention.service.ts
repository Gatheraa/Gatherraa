import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, Between } from 'typeorm';
import { EventAnalytics } from '../entities/event-analytics.entity';
import { AnalyticsSummary } from '../entities/analytics-summary.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';

export enum RetentionPolicyType {
  EVENT_ANALYTICS = 'event_analytics',
  ANALYTICS_SUMMARY = 'analytics_summary',
}

export interface RetentionPolicy {
  id: string;
  type: RetentionPolicyType;
  retentionPeriodDays: number; // Data older than this will be deleted
  isEnabled: boolean;
  lastRunAt?: Date;
}

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(EventAnalytics)
    private eventAnalyticsRepository: Repository<EventAnalytics>,
    @InjectRepository(AnalyticsSummary)
    private analyticsSummaryRepository: Repository<AnalyticsSummary>,
  ) {}

  /**
   * Default retention policies
   */
  private readonly defaultPolicies: RetentionPolicy[] = [
    {
      id: 'event-analytics-policy',
      type: RetentionPolicyType.EVENT_ANALYTICS,
      retentionPeriodDays: 365, // Keep event analytics for 1 year
      isEnabled: true,
    },
    {
      id: 'summary-analytics-policy',
      type: RetentionPolicyType.ANALYTICS_SUMMARY,
      retentionPeriodDays: 730, // Keep summaries for 2 years
      isEnabled: true,
    },
  ];

  /**
   * Get all retention policies
   */
  getPolicies(): RetentionPolicy[] {
    return this.defaultPolicies;
  }

  /**
   * Get a specific retention policy
   */
  getPolicy(type: RetentionPolicyType): RetentionPolicy | undefined {
    return this.defaultPolicies.find(policy => policy.type === type);
  }

  /**
   * Execute data retention cleanup based on policies
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async executeRetentionPolicies(): Promise<void> {
    this.logger.log('Starting data retention cleanup...');

    for (const policy of this.defaultPolicies) {
      if (policy.isEnabled) {
        await this.executePolicy(policy);
      }
    }

    this.logger.log('Completed data retention cleanup');
  }

  /**
   * Execute a specific retention policy
   */
  async executePolicy(policy: RetentionPolicy): Promise<number> {
    if (!policy.isEnabled) {
      return 0;
    }

    const cutoffDate = subDays(new Date(), policy.retentionPeriodDays);
    let deletedCount = 0;

    this.logger.log(`Executing retention policy for ${policy.type} with cutoff date: ${cutoffDate}`);

    switch (policy.type) {
      case RetentionPolicyType.EVENT_ANALYTICS:
        deletedCount = await this.cleanupEventAnalytics(cutoffDate);
        break;
      case RetentionPolicyType.ANALYTICS_SUMMARY:
        deletedCount = await this.cleanupAnalyticsSummaries(cutoffDate);
        break;
      default:
        this.logger.warn(`Unknown retention policy type: ${policy.type}`);
        return 0;
    }

    // Update policy with last run time
    const policyToUpdate = this.defaultPolicies.find(p => p.id === policy.id);
    if (policyToUpdate) {
      policyToUpdate.lastRunAt = new Date();
    }

    this.logger.log(`RetentionPolicy ${policy.type} deleted ${deletedCount} records`);

    return deletedCount;
  }

  /**
   * Cleanup old event analytics records
   */
  private async cleanupEventAnalytics(cutoffDate: Date): Promise<number> {
    const result = await this.eventAnalyticsRepository
      .createQueryBuilder('event_analytics')
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Cleanup old analytics summary records
   */
  private async cleanupAnalyticsSummaries(cutoffDate: Date): Promise<number> {
    const result = await this.analyticsSummaryRepository
      .createQueryBuilder('analytics_summary')
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Manually trigger retention for a specific policy type
   */
  async manualCleanup(policyType: RetentionPolicyType): Promise<number> {
    const policy = this.getPolicy(policyType);
    if (!policy) {
      throw new Error(`Policy not found for type: ${policyType}`);
    }

    return await this.executePolicy(policy);
  }

  /**
   * Update retention policy settings
   */
  async updatePolicy(type: RetentionPolicyType, retentionPeriodDays: number, isEnabled: boolean): Promise<void> {
    const policy = this.defaultPolicies.find(p => p.type === type);
    if (!policy) {
      throw new Error(`Policy not found for type: ${type}`);
    }

    policy.retentionPeriodDays = retentionPeriodDays;
    policy.isEnabled = isEnabled;
  }

  /**
   * Get statistics about data retention
   */
  async getRetentionStats(): Promise<Record<string, any>> {
    const now = new Date();
    
    const stats = {
      eventAnalytics: {
        total: await this.eventAnalyticsRepository.count(),
        olderThan30Days: await this.eventAnalyticsRepository.count({
          where: { createdAt: LessThan(subDays(now, 30)) }
        }),
        olderThan90Days: await this.eventAnalyticsRepository.count({
          where: { createdAt: LessThan(subDays(now, 90)) }
        }),
        olderThan1Year: await this.eventAnalyticsRepository.count({
          where: { createdAt: LessThan(subDays(now, 365)) }
        }),
      },
      analyticsSummaries: {
        total: await this.analyticsSummaryRepository.count(),
        olderThan30Days: await this.analyticsSummaryRepository.count({
          where: { createdAt: LessThan(subDays(now, 30)) }
        }),
        olderThan90Days: await this.analyticsSummaryRepository.count({
          where: { createdAt: LessThan(subDays(now, 90)) }
        }),
        olderThan1Year: await this.analyticsSummaryRepository.count({
          where: { createdAt: LessThan(subDays(now, 365)) }
        }),
      }
    };

    return stats;
  }
}