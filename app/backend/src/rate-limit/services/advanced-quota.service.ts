import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { ApiQuota, ApiTier, QuotaPeriod } from '../entities/api-quota.entity';
import { ApiUsageLog } from '../entities/api-usage-log.entity';
import { Redis } from 'ioredis';
import { addMinutes, addHours, addDays, addWeeks, addMonths, startOfMinute, startOfHour, startOfDay, startOfWeek, startOfMonth } from 'date-fns';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  overage?: number;
  cost?: number;
}

export interface UsageMetrics {
  totalRequests: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  hourlyUsage: Array<{ hour: string; requests: number }>;
}

@Injectable()
export class AdvancedQuotaService {
  private readonly logger = new Logger(AdvancedQuotaService.name);
  private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  constructor(
    @InjectRepository(ApiQuota)
    private quotaRepository: Repository<ApiQuota>,
    @InjectRepository(ApiUsageLog)
    private usageLogRepository: Repository<ApiUsageLog>,
  ) {}

  /**
   * Check if a request is within quota limits
   */
  async checkQuota(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    tier: ApiTier = ApiTier.FREE,
  ): Promise<QuotaCheckResult> {
    const quotas = await this.getActiveQuotas(userId, apiKeyId, endpoint, tier);
    
    if (quotas.length === 0) {
      // Apply default tier limits
      return this.checkDefaultTierLimits(userId, apiKeyId, endpoint, tier);
    }

    // Check all applicable quotas (most restrictive wins)
    const results = await Promise.all(
      quotas.map(quota => this.checkSingleQuota(quota))
    );

    // Return the most restrictive result
    return results.reduce((most, current) => 
      !current.allowed || current.remaining < most.remaining ? current : most
    );
  }

  /**
   * Record API usage
   */
  async recordUsage(
    usageData: Partial<ApiUsageLog>
  ): Promise<ApiUsageLog> {
    const usage = this.usageLogRepository.create(usageData);
    usage.timestamp = new Date();
    
    const savedUsage = await this.usageLogRepository.save(usage);

    // Update quota usage in real-time
    if (usage.userId && usage.endpoint) {
      await this.updateQuotaUsage(
        usage.userId,
        usage.apiKeyId,
        usage.endpoint,
        1,
        usage.cost || 0
      );
    }

    // Update Redis for real-time tracking
    await this.updateRealTimeMetrics(savedUsage);

    return savedUsage;
  }

  /**
   * Get usage metrics for a user or API key
   */
  async getUsageMetrics(
    userId?: string,
    apiKeyId?: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<UsageMetrics> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hour':
        startDate = startOfHour(now);
        break;
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
    }

    const query = this.usageLogRepository.createQueryBuilder('usage')
      .where('usage.timestamp >= :startDate', { startDate });

    if (userId) {
      query.andWhere('usage.userId = :userId', { userId });
    }

    if (apiKeyId) {
      query.andWhere('usage.apiKeyId = :apiKeyId', { apiKeyId });
    }

    const usage = await query.getMany();

    const totalRequests = usage.length;
    const totalCost = usage.reduce((sum, u) => sum + (u.cost || 0), 0);
    const averageResponseTime = usage.length > 0 
      ? usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length 
      : 0;
    const errorRate = usage.length > 0 
      ? (usage.filter(u => u.statusCode >= 400).length / usage.length) * 100 
      : 0;

    // Top endpoints
    const endpointCounts = usage.reduce((acc, u) => {
      acc[u.endpoint] = (acc[u.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Hourly usage
    const hourlyUsage = Array.from({ length: 24 }, (_, hour) => {
      const hourStart = new Date(now);
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(now);
      hourEnd.setHours(hour, 59, 59, 999);

      const count = usage.filter(u => 
        u.timestamp >= hourStart && u.timestamp <= hourEnd
      ).length;

      return {
        hour: hour.toString().padStart(2, '0'),
        requests: count
      };
    });

    return {
      totalRequests,
      totalCost,
      averageResponseTime,
      errorRate,
      topEndpoints,
      hourlyUsage
    };
  }

  /**
   * Create or update quota for a user
   */
  async setQuota(
    userId: string,
    endpoint: string,
    tier: ApiTier,
    period: QuotaPeriod,
    limit: number,
    overageRate: number = 0.01
  ): Promise<ApiQuota> {
    const now = new Date();
    const periodDates = this.getPeriodDates(period, now);

    let quota = await this.quotaRepository.findOne({
      where: {
        userId,
        endpoint,
        tier,
        period,
        periodStart: periodDates.start,
        periodEnd: periodDates.end
      }
    });

    if (!quota) {
      quota = this.quotaRepository.create({
        userId,
        endpoint,
        tier,
        period,
        limit,
        overageRate,
        periodStart: periodDates.start,
        periodEnd: periodDates.end,
        isActive: true
      });
    } else {
      quota.limit = limit;
      quota.overageRate = overageRate;
      quota.isActive = true;
    }

    return await this.quotaRepository.save(quota);
  }

  /**
   * Reset quotas for new period
   */
  async resetQuotas(): Promise<void> {
    const now = new Date();
    
    // Reset expired quotas
    await this.quotaRepository
      .createQueryBuilder()
      .update(ApiQuota)
      .set({ 
        used: 0, 
        overage: 0,
        isActive: false 
      })
      .where('periodEnd < :now', { now })
      .execute();

    // Create new quotas for active users
    const activeQuotas = await this.quotaRepository.find({
      where: { isActive: true },
      relations: ['user']
    });

    for (const quota of activeQuotas) {
      const periodDates = this.getPeriodDates(quota.period, now);
      
      const newQuota = this.quotaRepository.create({
        userId: quota.userId,
        apiKeyId: quota.apiKeyId,
        endpoint: quota.endpoint,
        tier: quota.tier,
        period: quota.period,
        limit: quota.limit,
        overageRate: quota.overageRate,
        periodStart: periodDates.start,
        periodEnd: periodDates.end,
        isActive: true,
        metadata: quota.metadata
      });

      await this.quotaRepository.save(newQuota);
    }

    this.logger.log(`Reset quotas for ${activeQuotas.length} users`);
  }

  /**
   * Get active quotas for a user
   */
  private async getActiveQuotas(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    tier: ApiTier
  ): Promise<ApiQuota[]> {
    return await this.quotaRepository.find({
      where: {
        userId,
        apiKeyId,
        endpoint,
        tier,
        isActive: true,
        periodStart: LessThan(new Date()),
        periodEnd: MoreThan(new Date())
      }
    });
  }

  /**
   * Check a single quota
   */
  private async checkSingleQuota(quota: ApiQuota): Promise<QuotaCheckResult> {
    const redisKey = `quota:${quota.userId}:${quota.endpoint}:${quota.period}`;
    const currentUsage = await this.redis.get(redisKey);
    const used = parseInt(currentUsage || '0');

    const allowed = used < quota.limit;
    const remaining = Math.max(0, quota.limit - used - 1);
    const overage = allowed ? 0 : used - quota.limit + 1;
    const cost = overage * quota.overageRate;

    return {
      allowed,
      remaining,
      limit: quota.limit,
      resetAt: quota.periodEnd,
      overage,
      cost
    };
  }

  /**
   * Check default tier limits
   */
  private async checkDefaultTierLimits(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    tier: ApiTier
  ): Promise<QuotaCheckResult> {
    const tierLimits = this.getTierLimits(tier);
    const redisKey = `tier:${userId}:${tier}:${endpoint}`;
    const currentUsage = await this.redis.get(redisKey);
    const used = parseInt(currentUsage || '0');

    const limit = tierLimits.requestsPerMinute;
    const allowed = used < limit;
    const remaining = Math.max(0, limit - used - 1);

    return {
      allowed,
      remaining,
      limit,
      resetAt: addMinutes(new Date(), 1),
      overage: allowed ? 0 : 1,
      cost: tierLimits.costPerRequest
    };
  }

  /**
   * Update quota usage in Redis
   */
  private async updateQuotaUsage(
    userId: string,
    apiKeyId: string,
    endpoint: string,
    requests: number,
    cost: number
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Update general usage
    pipeline.incr(`usage:${userId}:${endpoint}`);
    pipeline.expire(`usage:${userId}:${endpoint}`, 3600);

    // Update cost tracking
    pipeline.incrbyfloat(`cost:${userId}:${endpoint}`, cost);
    pipeline.expire(`cost:${userId}:${endpoint}`, 86400);

    await pipeline.exec();
  }

  /**
   * Update real-time metrics in Redis
   */
  private async updateRealTimeMetrics(usage: ApiUsageLog): Promise<void> {
    const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    
    await this.redis
      .pipeline()
      .incr(`metrics:requests:${minute}`)
      .incrbyfloat(`metrics:response_time:${minute}`, usage.responseTime)
      .incr(`metrics:errors:${minute}`)
      .expire(`metrics:requests:${minute}`, 3600)
      .expire(`metrics:response_time:${minute}`, 3600)
      .expire(`metrics:errors:${minute}`, 3600)
      .exec();
  }

  /**
   * Get period start and end dates
   */
  private getPeriodDates(period: QuotaPeriod, now: Date): { start: Date; end: Date } {
    switch (period) {
      case QuotaPeriod.MINUTE:
        return {
          start: startOfMinute(now),
          end: addMinutes(startOfMinute(now), 1)
        };
      case QuotaPeriod.HOUR:
        return {
          start: startOfHour(now),
          end: addHours(startOfHour(now), 1)
        };
      case QuotaPeriod.DAY:
        return {
          start: startOfDay(now),
          end: addDays(startOfDay(now), 1)
        };
      case QuotaPeriod.WEEK:
        return {
          start: startOfWeek(now),
          end: addWeeks(startOfWeek(now), 1)
        };
      case QuotaPeriod.MONTH:
        return {
          start: startOfMonth(now),
          end: addMonths(startOfMonth(now), 1)
        };
    }
  }

  /**
   * Get tier limits configuration
   */
  private getTierLimits(tier: ApiTier): {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    costPerRequest: number;
  } {
    const limits = {
      [ApiTier.FREE]: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        costPerRequest: 0
      },
      [ApiTier.BASIC]: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        costPerRequest: 0.001
      },
      [ApiTier.PROFESSIONAL]: {
        requestsPerMinute: 300,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        costPerRequest: 0.0005
      },
      [ApiTier.ENTERPRISE]: {
        requestsPerMinute: 1000,
        requestsPerHour: 20000,
        requestsPerDay: 200000,
        costPerRequest: 0.0001
      },
      [ApiTier.CUSTOM]: {
        requestsPerMinute: 2000,
        requestsPerHour: 50000,
        requestsPerDay: 500000,
        costPerRequest: 0.00005
      }
    };

    return limits[tier] || limits[ApiTier.FREE];
  }
}
