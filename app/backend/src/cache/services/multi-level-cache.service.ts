import { Injectable, Logger } from '@nestjs/common';
import { AdvancedCacheService } from './advanced-cache.service';
import { CachePerformanceService } from './cache-performance.service';

export interface MultiLevelCacheConfig {
  memoryCacheSize: number;
  memoryTtl: number;
  redisTtl: number;
  enableCompression: boolean;
  enableSerialization: boolean;
  compressionThreshold: number;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  compressed: boolean;
  serialized: boolean;
  hits: number;
  lastAccessed: number;
  priority: 'low' | 'medium' | 'high';
}

@Injectable()
export class MultiLevelCacheService {
  private readonly logger = new Logger(MultiLevelCacheService.name);
  private memoryCache = new Map<string, CacheEntry<any>>();
  private config: MultiLevelCacheConfig = {
    memoryCacheSize: 1000,
    memoryTtl: 300, // 5 minutes
    redisTtl: 3600, // 1 hour
    enableCompression: true,
    enableSerialization: true,
    compressionThreshold: 1024 // 1KB
  };

  constructor(
    private cacheService: AdvancedCacheService,
    private performanceService: CachePerformanceService,
  ) {
    this.startMemoryCleanup();
  }

  /**
   * Get value from multi-level cache
   */
  async get<T>(key: string, options: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    useMemoryOnly?: boolean;
  } = {}): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Level 1: Memory cache
      const memoryValue = this.getFromMemory<T>(key);
      if (memoryValue !== null) {
        this.performanceService.recordOperation('get', Date.now() - startTime, true);
        return memoryValue;
      }

      if (options.useMemoryOnly) {
        this.performanceService.recordOperation('get', Date.now() - startTime, true);
        return null;
      }

      // Level 2: Redis cache
      const redisValue = await this.getFromRedis<T>(key, options);
      if (redisValue !== null) {
        // Store in memory for faster access
        this.setToMemory(key, redisValue, options);
        this.performanceService.recordOperation('get', Date.now() - startTime, true);
        return redisValue;
      }

      this.performanceService.recordOperation('get', Date.now() - startTime, true);
      return null;

    } catch (error) {
      this.logger.error(`Multi-level cache get error for key ${key}: ${error.message}`);
      this.performanceService.recordOperation('get', Date.now() - startTime, false);
      return null;
    }
  }

  /**
   * Set value in multi-level cache
   */
  async set<T>(key: string, value: T, options: {
    ttl?: number;
    priority?: 'low' | 'medium' | 'high';
    compress?: boolean;
    serialize?: boolean;
    memoryOnly?: boolean;
  } = {}): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || this.config.memoryTtl;
      const priority = options.priority || 'medium';

      // Level 1: Memory cache
      this.setToMemory(key, value, { ttl, priority });

      // Level 2: Redis cache
      if (!options.memoryOnly) {
        await this.setToRedis(key, value, {
          ttl: options.ttl || this.config.redisTtl,
          priority,
          compress: options.compress,
          serialize: options.serialize
        });
      }

      this.performanceService.recordOperation('set', Date.now() - startTime, true);

    } catch (error) {
      this.logger.error(`Multi-level cache set error for key ${key}: ${error.message}`);
      this.performanceService.recordOperation('set', Date.now() - startTime, false);
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Delete from memory
      this.memoryCache.delete(key);

      // Delete from Redis
      await this.cacheService.delete(key);

      this.performanceService.recordOperation('delete', Date.now() - startTime, true);

    } catch (error) {
      this.logger.error(`Multi-level cache delete error for key ${key}: ${error.message}`);
      this.performanceService.recordOperation('delete', Date.now() - startTime, false);
    }
  }

  /**
   * Invalidate pattern across all levels
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Invalidate from memory
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }

      // Invalidate from Redis
      await this.cacheService.invalidatePattern(pattern);

      this.logger.log(`Invalidated pattern: ${pattern}`);

    } catch (error) {
      this.logger.error(`Pattern invalidation error: ${error.message}`);
    }
  }

  /**
   * Get memory cache statistics
   */
  getMemoryStats(): {
    size: number;
    maxSize: number;
    hitRatio: number;
    memoryUsage: number;
  } {
    let totalHits = 0;
    let totalAccesses = 0;
    let memoryUsage = 0;

    for (const entry of this.memoryCache.values()) {
      totalHits += entry.hits;
      totalAccesses += entry.hits;
      memoryUsage += this.estimateEntrySize(entry);
    }

    return {
      size: this.memoryCache.size,
      maxSize: this.config.memoryCacheSize,
      hitRatio: totalAccesses > 0 ? totalHits / totalAccesses : 0,
      memoryUsage
    };
  }

  /**
   * Warm up memory cache
   */
  async warmupMemory(keys: string[]): Promise<void> {
    this.logger.log(`Warming up memory cache with ${keys.length} keys`);

    for (const key of keys) {
      try {
        const value = await this.cacheService.get(key);
        if (value !== null) {
          this.setToMemory(key, value, { priority: 'high' });
        }
      } catch (error) {
        this.logger.error(`Failed to warmup key ${key}: ${error.message}`);
      }
    }

    this.logger.log('Memory cache warmup completed');
  }

  /**
   * Get from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    const now = Date.now();
    
    // Check TTL
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = now;

    return entry.value;
  }

  /**
   * Set to memory cache
   */
  private setToMemory<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): void {
    const now = Date.now();
    const ttl = options.ttl || this.config.memoryTtl;
    const priority = options.priority || 'medium';

    // Check memory limit
    if (this.memoryCache.size >= this.config.memoryCacheSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      ttl,
      compressed: false,
      serialized: false,
      hits: 0,
      lastAccessed: now,
      priority
    };

    this.memoryCache.set(key, entry);
  }

  /**
   * Get from Redis cache
   */
  private async getFromRedis<T>(
    key: string, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<T | null> {
    const cacheOptions = {
      ttl: options.ttl || this.config.redisTtl,
      priority: options.priority || 'medium',
      compress: this.config.enableCompression,
      serialize: this.config.enableSerialization
    };

    return await this.cacheService.get<T>(key, cacheOptions);
  }

  /**
   * Set to Redis cache
   */
  private async setToRedis<T>(
    key: string, 
    value: T, 
    options: {
      ttl?: number;
      priority?: 'low' | 'medium' | 'high';
      compress?: boolean;
      serialize?: boolean;
    } = {}
  ): Promise<void> {
    const shouldCompress = options.compress ?? this.config.enableCompression;
    const shouldSerialize = options.serialize ?? this.config.enableSerialization;

    // Check compression threshold
    let compress = shouldCompress;
    if (shouldCompress && this.config.compressionThreshold > 0) {
      const size = this.estimateSize(value);
      compress = size > this.config.compressionThreshold;
    }

    const cacheOptions = {
      ttl: options.ttl || this.config.redisTtl,
      priority: options.priority || 'medium',
      compress,
      serialize: shouldSerialize
    };

    await this.cacheService.set(key, value, cacheOptions);
  }

  /**
   * Evict least used entries from memory
   */
  private evictLeastUsed(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Date.now();
    let lowestPriority = 'high';

    for (const [key, entry] of this.memoryCache.entries()) {
      // First, evict expired entries
      if (Date.now() - entry.timestamp > entry.ttl * 1000) {
        this.memoryCache.delete(key);
        continue;
      }

      // Then, evict based on priority and last access
      if (entry.priority === 'low') {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          oldestKey = key;
        }
      } else if (entry.priority === 'medium' && lowestPriority !== 'low') {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          oldestKey = key;
          lowestPriority = 'medium';
        }
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Start memory cleanup
   */
  private startMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now - entry.timestamp > entry.ttl * 1000) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
      }

      if (keysToDelete.length > 0) {
        this.logger.debug(`Cleaned up ${keysToDelete.length} expired memory cache entries`);
      }
    }, 60000); // Cleanup every minute
  }

  /**
   * Estimate entry size
   */
  private estimateEntrySize(entry: CacheEntry<any>): number {
    return this.estimateSize(entry.value) + 100; // Add overhead
  }

  /**
   * Estimate object size
   */
  private estimateSize(obj: any): number {
    if (obj === null || obj === undefined) {
      return 0;
    }

    if (typeof obj === 'string') {
      return obj.length * 2; // Unicode characters
    }

    if (typeof obj === 'number') {
      return 8; // 64-bit number
    }

    if (typeof obj === 'boolean') {
      return 4;
    }

    if (obj instanceof Date) {
      return 24; // Date object
    }

    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.estimateSize(item), 0) + 24;
    }

    if (typeof obj === 'object') {
      let size = 24; // Object overhead
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          size += key.length * 2 + this.estimateSize(obj[key]);
        }
      }
      return size;
    }

    return 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MultiLevelCacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log('Multi-level cache configuration updated');
  }

  /**
   * Clear memory cache
   */
  clearMemory(): void {
    this.memoryCache.clear();
    this.logger.log('Memory cache cleared');
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: ReturnType<typeof this.getMemoryStats>;
    redis: any;
    overall: {
      hitRatio: number;
      totalOperations: number;
      averageResponseTime: number;
    };
  }> {
    const memoryStats = this.getMemoryStats();
    const redisStats = await this.cacheService.getStats();
    const performanceMetrics = await this.performanceService.getMetrics();

    return {
      memory: memoryStats,
      redis: redisStats,
      overall: {
        hitRatio: performanceMetrics.hitRatio,
        totalOperations: performanceMetrics.hits + performanceMetrics.misses,
        averageResponseTime: performanceMetrics.averageResponseTime
      }
    };
  }
}
