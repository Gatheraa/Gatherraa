import { Injectable, Logger } from '@nestjs/common';
import { AdvancedCacheService } from './advanced-cache.service';
import { RedisAdapterService } from '../../notifications/providers/redis-adapter.service';

export interface InvalidationRule {
  pattern: string;
  reason: string;
  priority: number;
  cascade?: string[]; // Additional patterns to invalidate
}

export interface ConsistencyConfig {
  enableDistributedInvalidation: boolean;
  enableVersioning: boolean;
  enableLocking: boolean;
  lockTimeout: number;
  maxRetries: number;
}

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private invalidationRules: Map<string, InvalidationRule> = new Map();
  private config: ConsistencyConfig = {
    enableDistributedInvalidation: true,
    enableVersioning: true,
    enableLocking: true,
    lockTimeout: 30000,
    maxRetries: 3
  };

  constructor(
    private cacheService: AdvancedCacheService,
    private redisAdapter: RedisAdapterService,
  ) {
    this.initializeInvalidationRules();
    this.setupDistributedInvalidation();
  }

  /**
   * Invalidate cache by key pattern
   */
  async invalidatePattern(pattern: string, reason: string = 'Manual'): Promise<void> {
    try {
      this.logger.log(`Invalidating cache pattern: ${pattern} (${reason})`);

      // Local invalidation
      await this.cacheService.invalidatePattern(pattern);

      // Distributed invalidation
      if (this.config.enableDistributedInvalidation) {
        await this.publishInvalidation(pattern, reason);
      }

      // Cascade invalidation
      const rule = this.invalidationRules.get(pattern);
      if (rule?.cascade) {
        for (const cascadePattern of rule.cascade) {
          await this.invalidatePattern(cascadePattern, `Cascade from ${pattern}`);
        }
      }

    } catch (error) {
      this.logger.error(`Failed to invalidate pattern ${pattern}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Invalidate cache for specific entity
   */
  async invalidateEntity(entityType: string, entityId: string, reason?: string): Promise<void> {
    const patterns = [
      `${entityType}:${entityId}`,
      `${entityType}:${entityId}:*`,
      `*:${entityType}:${entityId}`,
      `*:${entityType}:${entityId}:*`
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern, reason || `Entity ${entityType}:${entityId} update`);
    }
  }

  /**
   * Invalidate user-related cache
   */
  async invalidateUserCache(userId: string, reason?: string): Promise<void> {
    const patterns = [
      `user:${userId}`,
      `user:${userId}:*`,
      `*:${userId}`,
      `*:${userId}:*`
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern, reason || `User ${userId} update`);
    }
  }

  /**
   * Invalidate event-related cache
   */
  async invalidateEventCache(eventId: string, reason?: string): Promise<void> {
    const patterns = [
      `event:${eventId}`,
      `event:${eventId}:*`,
      `events:*:${eventId}`,
      `*:${eventId}`,
      `*:${eventId}:*`
    ];

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern, reason || `Event ${eventId} update`);
    }
  }

  /**
   * Invalidate with distributed locking
   */
  async invalidateWithLock(
    pattern: string, 
    reason: string = 'Manual',
    lockKey?: string
  ): Promise<void> {
    if (!this.config.enableLocking) {
      return this.invalidatePattern(pattern, reason);
    }

    const lockKey = lockKey || `cache:lock:${pattern}`;
    const lockValue = `${Date.now()}:${Math.random()}`;

    try {
      // Acquire lock
      const lockAcquired = await this.acquireLock(lockKey, lockValue);
      
      if (!lockAcquired) {
        this.logger.warn(`Failed to acquire lock for pattern: ${pattern}`);
        return;
      }

      // Perform invalidation
      await this.invalidatePattern(pattern, reason);

      // Release lock
      await this.releaseLock(lockKey, lockValue);

    } catch (error) {
      this.logger.error(`Invalidation with lock failed for ${pattern}: ${error.message}`);
      await this.releaseLock(lockKey, lockValue);
      throw error;
    }
  }

  /**
   * Versioned cache invalidation
   */
  async invalidateVersioned(
    key: string, 
    version: string, 
    reason?: string
  ): Promise<void> {
    if (!this.config.enableVersioning) {
      return this.invalidatePattern(key, reason);
    }

    try {
      // Store version
      await this.cacheService.set(`${key}:version`, version, { ttl: 86400 });

      // Invalidate main key
      await this.cacheService.delete(key);

      // Publish version update
      if (this.config.enableDistributedInvalidation) {
        await this.publishVersionUpdate(key, version, reason);
      }

      this.logger.log(`Versioned invalidation: ${key} -> ${version}`);

    } catch (error) {
      this.logger.error(`Versioned invalidation failed for ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current version for a key
   */
  async getVersion(key: string): Promise<string | null> {
    if (!this.config.enableVersioning) {
      return null;
    }

    return await this.cacheService.get(`${key}:version`);
  }

  /**
   * Check if cache is valid for version
   */
  async isVersionValid(key: string, expectedVersion: string): Promise<boolean> {
    if (!this.config.enableVersioning) {
      return true;
    }

    const currentVersion = await this.getVersion(key);
    return currentVersion === expectedVersion;
  }

  /**
   * Register invalidation rule
   */
  registerInvalidationRule(pattern: string, rule: InvalidationRule): void {
    this.invalidationRules.set(pattern, rule);
    this.logger.log(`Registered invalidation rule: ${pattern}`);
  }

  /**
   * Bulk invalidation
   */
  async bulkInvalidate(
    patterns: string[], 
    reason: string = 'Bulk operation'
  ): Promise<void> {
    const results = await Promise.allSettled(
      patterns.map(pattern => this.invalidatePattern(pattern, reason))
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      this.logger.error(`Bulk invalidation failed for ${failed.length} patterns`);
      throw new Error(`Bulk invalidation partially failed`);
    }
  }

  /**
   * Smart invalidation based on data changes
   */
  async smartInvalidate(
    entityType: string, 
    entityId: string, 
    changes: Record<string, any>
  ): Promise<void> {
    const patterns = [`${entityType}:${entityId}`];

    // Add related patterns based on changed fields
    if (changes.categoryId) {
      patterns.push(`category:${changes.categoryId}:*`);
    }

    if (changes.userId) {
      patterns.push(`user:${changes.userId}:*`);
    }

    if (changes.status) {
      patterns.push(`${entityType}:status:${changes.status}:*`);
    }

    for (const pattern of patterns) {
      await this.invalidatePattern(pattern, `Smart invalidation for ${entityType}:${entityId}`);
    }
  }

  /**
   * Setup distributed invalidation
   */
  private setupDistributedInvalidation(): void {
    if (!this.config.enableDistributedInvalidation) {
      return;
    }

    this.redisAdapter.subscribe('cache:invalidation', (message) => {
      this.handleDistributedInvalidation(message);
    });

    this.redisAdapter.subscribe('cache:version', (message) => {
      this.handleVersionUpdate(message);
    });
  }

  /**
   * Handle distributed invalidation
   */
  private async handleDistributedInvalidation(message: any): Promise<void> {
    try {
      if (message.type === 'cache_invalidation') {
        await this.cacheService.invalidatePattern(message.data.pattern);
        this.logger.debug(`Distributed invalidation: ${message.data.pattern}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle distributed invalidation: ${error.message}`);
    }
  }

  /**
   * Handle version update
   */
  private async handleVersionUpdate(message: any): Promise<void> {
    try {
      if (message.type === 'version_update') {
        await this.cacheService.set(
          `${message.data.key}:version`, 
          message.data.version, 
          { ttl: 86400 }
        );
        this.logger.debug(`Version update: ${message.data.key} -> ${message.data.version}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle version update: ${error.message}`);
    }
  }

  /**
   * Publish invalidation to Redis
   */
  private async publishInvalidation(pattern: string, reason: string): Promise<void> {
    await this.redisAdapter.publish('cache:invalidation', {
      type: 'cache_invalidation',
      data: { pattern, reason, timestamp: Date.now() }
    });
  }

  /**
   * Publish version update
   */
  private async publishVersionUpdate(key: string, version: string, reason?: string): Promise<void> {
    await this.redisAdapter.publish('cache:version', {
      type: 'version_update',
      data: { key, version, reason, timestamp: Date.now() }
    });
  }

  /**
   * Acquire distributed lock
   */
  private async acquireLock(lockKey: string, lockValue: string): Promise<boolean> {
    try {
      const result = await this.redisAdapter.setWithExpiry(
        lockKey, 
        lockValue, 
        this.config.lockTimeout / 1000
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    try {
      const currentValue = await this.redisAdapter.get(lockKey);
      if (currentValue === lockValue) {
        await this.redisAdapter.delete(lockKey);
      }
    } catch (error) {
      this.logger.error(`Failed to release lock ${lockKey}: ${error.message}`);
    }
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeInvalidationRules(): void {
    // User-related rules
    this.registerInvalidationRule('user:*', {
      pattern: 'user:*',
      reason: 'User data update',
      priority: 1,
      cascade: ['user:*:notifications', 'user:*:activity', 'user:*:preferences']
    });

    // Event-related rules
    this.registerInvalidationRule('event:*', {
      pattern: 'event:*',
      reason: 'Event data update',
      priority: 1,
      cascade: ['event:*:participants', 'event:*:related', 'events:popular']
    });

    // Category-related rules
    this.registerInvalidationRule('category:*', {
      pattern: 'category:*',
      reason: 'Category data update',
      priority: 2,
      cascade: ['categories:*', 'events:category:*']
    });

    // Analytics rules
    this.registerInvalidationRule('analytics:*', {
      pattern: 'analytics:*',
      reason: 'Analytics data update',
      priority: 3,
      cascade: ['dashboard:*', 'reports:*']
    });
  }
}
