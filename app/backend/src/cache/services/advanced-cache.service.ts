import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  serialize?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRatio: number;
  memoryUsage: number;
  keyCount: number;
}

@Injectable()
export class AdvancedCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AdvancedCacheService.name);
  private redis: Redis;
  private memoryCache = new Map<string, { value: any; expiry: number; priority: string }>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRatio: 0,
    memoryUsage: 0,
    keyCount: 0
  };

  constructor(private configService: ConfigService) {
    this.initializeRedis();
    this.startMemoryCleanup();
  }

  private initializeRedis() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
    
    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableReadyCheck: true,
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      // Try memory cache first
      const memoryValue = this.getFromMemory(key);
      if (memoryValue !== null) {
        this.stats.hits++;
        return memoryValue;
      }

      // Try Redis
      const redisValue = await this.getFromRedis(key, options);
      if (redisValue !== null) {
        this.stats.hits++;
        // Store in memory for faster access
        this.setToMemory(key, redisValue, options);
        return redisValue;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      this.stats.sets++;

      // Set in memory
      this.setToMemory(key, value, options);

      // Set in Redis
      await this.setToRedis(key, value, options);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.stats.deletes++;

      // Delete from memory
      this.memoryCache.delete(key);

      // Delete from Redis
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Delete from memory
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }

      // Delete from Redis
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error(`Cache invalidate pattern error: ${error.message}`);
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseMemoryInfo(info);
      const keyCount = await this.redis.dbsize();

      this.stats.memoryUsage = memoryUsage;
      this.stats.keyCount = keyCount;
      this.stats.hitRatio = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;

      return { ...this.stats };
    } catch (error) {
      this.logger.error(`Failed to get cache stats: ${error.message}`);
      return this.stats;
    }
  }

  private getFromMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.value;
  }

  private async getFromRedis<T>(key: string, options: CacheOptions): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      return options.compress ? this.decompress(parsed) : parsed;
    } catch {
      return value as T;
    }
  }

  private setToMemory<T>(key: string, value: T, options: CacheOptions): void {
    const ttl = options.ttl || 3600;
    const expiry = Date.now() + (ttl * 1000);
    const priority = options.priority || 'medium';

    // Check memory limit
    if (this.memoryCache.size >= 1000) {
      this.evictLeastPriority();
    }

    this.memoryCache.set(key, { value, expiry, priority });
  }

  private async setToRedis<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const ttl = options.ttl || 3600;
    let serializedValue = JSON.stringify(value);

    if (options.compress) {
      serializedValue = this.compress(serializedValue);
    }

    await this.redis.setex(key, ttl, serializedValue);
  }

  private evictLeastPriority(): void {
    let lowestPriority = 'high';
    let evictKey: string | null = null;

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.priority === 'low') {
        evictKey = key;
        break;
      }
      if (item.priority === 'medium' && lowestPriority !== 'low') {
        evictKey = key;
        lowestPriority = 'medium';
      }
    }

    if (evictKey) {
      this.memoryCache.delete(evictKey);
    }
  }

  private startMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.memoryCache.entries()) {
        if (now > item.expiry) {
          this.memoryCache.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  private compress(data: string): string {
    // Simple compression - in production use zlib or similar
    return Buffer.from(data).toString('base64');
  }

  private decompress(data: string): string {
    // Simple decompression - in production use zlib or similar
    return Buffer.from(data, 'base64').toString();
  }

  private parseMemoryInfo(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
