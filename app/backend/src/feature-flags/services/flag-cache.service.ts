import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { FeatureFlag } from '../entities/feature-flag.entity';

@Injectable()
export class FlagCacheService {
  private readonly logger = new Logger(FlagCacheService.name);
  private redisClient: Redis;
  private subscriberClient: Redis;
  private readonly FLAG_PREFIX = 'flag:';
  private readonly FLAG_UPDATE_CHANNEL = 'flag:updates';
  private updateCallbacks: ((flagKey: string) => void)[] = [];

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';

    this.redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      keyPrefix: 'feature_flags:',
    });

    this.subscriberClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redisClient.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Connected to Redis for feature flags');
    });

    // Subscribe to flag updates
    this.subscriberClient.subscribe(this.FLAG_UPDATE_CHANNEL, (error) => {
      if (error) {
        this.logger.error(`Failed to subscribe to flag updates: ${error.message}`);
      } else {
        this.logger.log('Subscribed to flag update channel');
      }
    });

    this.subscriberClient.on('message', (channel, message) => {
      if (channel === this.FLAG_UPDATE_CHANNEL) {
        const flagKey = message;
        this.logger.log(`Flag update received for: ${flagKey}`);
        this.handleFlagUpdate(flagKey);
      }
    });
  }

  /**
   * Get flag from cache
   */
  async getFlag(key: string): Promise<FeatureFlag | null> {
    try {
      const cached = await this.redisClient.get(this.FLAG_PREFIX + key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      this.logger.error(`Error getting flag from cache: ${error.message}`);
      return null;
    }
  }

  /**
   * Set flag in cache
   */
  async setFlag(flag: FeatureFlag, ttl: number = 3600): Promise<void> {
    try {
      await this.redisClient.setex(
        this.FLAG_PREFIX + flag.key,
        ttl,
        JSON.stringify(flag),
      );
    } catch (error) {
      this.logger.error(`Error setting flag in cache: ${error.message}`);
    }
  }

  /**
   * Delete flag from cache
   */
  async deleteFlag(key: string): Promise<void> {
    try {
      await this.redisClient.del(this.FLAG_PREFIX + key);
    } catch (error) {
      this.logger.error(`Error deleting flag from cache: ${error.message}`);
    }
  }

  /**
   * Publish flag update event
   */
  async publishFlagUpdate(flagKey: string): Promise<void> {
    try {
      await this.redisClient.publish(this.FLAG_UPDATE_CHANNEL, flagKey);
      this.logger.log(`Published flag update for: ${flagKey}`);
    } catch (error) {
      this.logger.error(`Error publishing flag update: ${error.message}`);
    }
  }

  /**
   * Handle flag update event
   */
  private handleFlagUpdate(flagKey: string): void {
    // Invalidate cache
    this.deleteFlag(flagKey);
    
    // Notify callbacks
    this.updateCallbacks.forEach((callback) => callback(flagKey));
  }

  /**
   * Subscribe to flag updates
   */
  onFlagUpdate(callback: (flagKey: string) => void): void {
    this.updateCallbacks.push(callback);
  }

  /**
   * Get all flags from cache
   */
  async getAllFlags(): Promise<Record<string, FeatureFlag>> {
    try {
      const keys = await this.redisClient.keys(this.FLAG_PREFIX + '*');
      const flags: Record<string, FeatureFlag> = {};

      for (const key of keys) {
        const flagKey = key.replace(/^feature_flags:flag:/, '');
        const cached = await this.redisClient.get(key);
        if (cached) {
          flags[flagKey] = JSON.parse(cached);
        }
      }

      return flags;
    } catch (error) {
      this.logger.error(`Error getting all flags from cache: ${error.message}`);
      return {};
    }
  }

  /**
   * Clear all flag cache
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await this.redisClient.keys(this.FLAG_PREFIX + '*');
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
      this.logger.log('Cleared all flag cache');
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = await this.redisClient.keys(this.FLAG_PREFIX + '*');
      const info = await this.redisClient.info('memory');
      
      return {
        cachedFlags: keys.length,
        memoryInfo: info,
      };
    } catch (error) {
      this.logger.error(`Error getting cache stats: ${error.message}`);
      return null;
    }
  }
}
