import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from './rate-limit.config';
import { RateLimitStore } from './stores/store.interface';
import { MemoryStore } from './stores/memory.store';
import { RedisStore } from './stores/redis.store';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;    // Unix ms timestamp when oldest request exits window
  retryAfter: number; // Seconds until the client may retry
}

export const RATE_LIMIT_REDIS = 'RATE_LIMIT_REDIS';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly store: RateLimitStore;

  constructor(
    private readonly memoryStore: MemoryStore,
    @Optional() @Inject(RATE_LIMIT_REDIS) private readonly redisClient?: any,
  ) {
    if (redisClient) {
      this.store = new RedisStore(redisClient);
      this.logger.log('RateLimitService using Redis store');
    } else {
      this.store = memoryStore;
      this.logger.log('RateLimitService using in-memory store (Redis not configured)');
    }
  }

  async check(
    req: any,
    config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
  ): Promise<RateLimitResult> {
    const keys = this.buildKeys(req, config);
    // When strategy is 'ip-and-user', both keys must be under limit
    const results = await Promise.all(
      keys.map(key => this.checkKey(key, config)),
    );

    // Return the most constrained result
    const worst = results.reduce((a, b) => (a.remaining <= b.remaining ? a : b));
    return worst;
  }

  async reset(req: any, config: RateLimitConfig): Promise<void> {
    const keys = this.buildKeys(req, config);
    await Promise.all(keys.map(key => this.store.reset(key)));
  }

  private async checkKey(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const entry = await this.store.hit(key, config.windowMs);
    const allowed   = entry.count <= config.limit;
    const remaining = Math.max(0, config.limit - entry.count);

    // Oldest timestamp in window tells us when a slot frees up
    const oldest  = entry.timestamps[0] ?? Date.now();
    const resetAt = oldest + config.windowMs;
    const retryAfter = allowed ? 0 : Math.ceil((resetAt - Date.now()) / 1000);

    return { allowed, limit: config.limit, remaining, resetAt, retryAfter };
  }

  private buildKeys(req: any, config: RateLimitConfig): string[] {
    const ip     = this.extractIp(req);
    const userId = req.user?.id ?? req.user?.sub ?? null;
    const route  = `${req.method}:${req.route?.path ?? req.path ?? 'unknown'}`;

    switch (config.strategy) {
      case 'ip':
        return [`rl:ip:${ip}:${route}`];
      case 'user':
        // Fall back to IP if unauthenticated
        return userId
          ? [`rl:user:${userId}:${route}`]
          : [`rl:ip:${ip}:${route}`];
      case 'ip-and-user':
        return userId
          ? [`rl:ip:${ip}:${route}`, `rl:user:${userId}:${route}`]
          : [`rl:ip:${ip}:${route}`];
    }
  }

  private extractIp(req: any): string {
    return (
      req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.headers?.['x-real-ip'] ??
      req.socket?.remoteAddress ??
      req.ip ??
      'unknown'
    );
  }
}