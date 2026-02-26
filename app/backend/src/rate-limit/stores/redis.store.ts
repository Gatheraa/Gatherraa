import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RateLimitEntry, RateLimitStore } from './store.interface';

/**
 * Redis-backed sliding window store using a sorted set per key.
 * Each member is a unique request ID (timestamp:random), scored by timestamp.
 * This gives exact sliding window semantics with atomic Lua operations.
 *
 * Requires: ioredis  (`npm install ioredis`)
 * The Redis client is injected via the RATE_LIMIT_REDIS token.
 */
@Injectable()
export class RedisStore implements RateLimitStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisStore.name);
  private readonly lua: string;

  constructor(private readonly redis: any /* Redis from ioredis */) {
    /**
     * Atomic Lua script:
     * 1. Remove members outside the sliding window
     * 2. Add the new request with current timestamp as score
     * 3. Set TTL on the key equal to windowMs
     * 4. Return the current count
     */
    this.lua = `
      local key      = KEYS[1]
      local now      = tonumber(ARGV[1])
      local window   = tonumber(ARGV[2])
      local cutoff   = now - window
      local member   = ARGV[3]

      redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
      redis.call('ZADD', key, now, member)
      redis.call('PEXPIRE', key, window)
      local count = redis.call('ZCARD', key)
      local members = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
      return {count, members}
    `;
  }

  async hit(key: string, windowMs: number): Promise<RateLimitEntry> {
    try {
      const now    = Date.now();
      const member = `${now}:${Math.random().toString(36).slice(2)}`;

      const result: any = await this.redis.eval(
        this.lua,
        1,          // number of KEYS
        key,        // KEYS[1]
        String(now),
        String(windowMs),
        member,
      );

      const count      = Number(result[0]);
      const rawMembers = result[1] as string[];

      // Reconstruct timestamps from member scores
      const timestamps: number[] = [];
      for (let i = 0; i < rawMembers.length; i += 2) {
        timestamps.push(Number(rawMembers[i + 1]));
      }

      return { timestamps, count };
    } catch (err) {
      this.logger.error('Redis rate-limit hit failed, falling back to allow', err);
      // Fail open: if Redis is down, let the request through
      return { timestamps: [], count: 0 };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error('Redis rate-limit reset failed', err);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }
}