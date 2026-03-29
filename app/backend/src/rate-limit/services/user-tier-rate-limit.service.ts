import { Injectable, Logger } from '@nestjs/common';
import { RateLimitConfig } from '../rate-limit.config';

export interface UserTierLimits {
  FREE: RateLimitConfig;
  BASIC: RateLimitConfig;
  PREMIUM: RateLimitConfig;
  ENTERPRISE: RateLimitConfig;
}

@Injectable()
export class UserTierRateLimitService {
  private readonly logger = new Logger(UserTierRateLimitService.name);

  private readonly tierLimits: UserTierLimits = {
    FREE: {
      limit: 60,
      windowMs: 60_000, // 1 minute
      strategy: 'ip',
      message: 'Free tier rate limit exceeded. Upgrade for higher limits.',
    },
    BASIC: {
      limit: 150,
      windowMs: 60_000, // 1 minute
      strategy: 'ip-and-user',
      message: 'Basic tier rate limit exceeded.',
    },
    PREMIUM: {
      limit: 500,
      windowMs: 60_000, // 1 minute
      strategy: 'user',
      message: 'Premium tier rate limit exceeded.',
    },
    ENTERPRISE: {
      limit: 2000,
      windowMs: 60_000, // 1 minute
      strategy: 'user',
      message: 'Enterprise tier rate limit exceeded.',
    },
  };

  getTierLimits(tier: keyof UserTierLimits): RateLimitConfig {
    return this.tierLimits[tier] || this.tierLimits.FREE;
  }

  getAdjustedConfig(baseConfig: RateLimitConfig, userTier: keyof UserTierLimits): RateLimitConfig {
    const tierLimits = this.getTierLimits(userTier);
    
    // Use the more restrictive limits between base config and tier limits
    return {
      ...baseConfig,
      limit: Math.min(baseConfig.limit, tierLimits.limit),
      windowMs: Math.max(baseConfig.windowMs, tierLimits.windowMs),
      strategy: baseConfig.strategy || tierLimits.strategy,
      message: baseConfig.message || tierLimits.message,
    };
  }

  getUserTier(user: any): keyof UserTierLimits {
    if (!user) return 'FREE';
    
    // Check user tier based on various factors
    if (user.subscription?.plan === 'enterprise') return 'ENTERPRISE';
    if (user.subscription?.plan === 'premium') return 'PREMIUM';
    if (user.subscription?.plan === 'basic') return 'BASIC';
    
    // Check for special roles or flags
    if (user.roles?.includes('ENTERPRISE')) return 'ENTERPRISE';
    if (user.roles?.includes('PREMIUM')) return 'PREMIUM';
    if (user.roles?.includes('BASIC')) return 'BASIC';
    
    return 'FREE';
  }

  async logTierUsage(userId: string, tier: string, endpoint: string, allowed: boolean): Promise<void> {
    this.logger.log(`Rate limit check: userId=${userId}, tier=${tier}, endpoint=${endpoint}, allowed=${allowed}`);
    
    // Here you could integrate with your monitoring/analytics system
    // For example: send to Elasticsearch, Datadog, or your analytics service
  }
}
