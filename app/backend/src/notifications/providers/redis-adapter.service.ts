import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface RedisMessage {
  type: string;
  userId?: string;
  userIds?: string[];
  data: any;
  timestamp: number;
}

@Injectable()
export class RedisAdapterService {
  private readonly logger = new Logger(RedisAdapterService.name);
  private publisherClient: Redis;
  private subscriberClient: Redis;
  private readonly channels = new Map<string, Function[]>();

  constructor(private configService: ConfigService) {
    this.initializeRedisClients();
  }

  private initializeRedisClients() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';

    this.publisherClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    this.subscriberClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    this.publisherClient.on('error', (error) => {
      this.logger.error(`Publisher Redis error: ${error.message}`);
    });

    this.subscriberClient.on('error', (error) => {
      this.logger.error(`Subscriber Redis error: ${error.message}`);
    });

    this.publisherClient.on('connect', () => {
      this.logger.log('Publisher connected to Redis');
    });

    this.subscriberClient.on('connect', () => {
      this.logger.log('Subscriber connected to Redis');
    });

    // Setup message handler
    this.subscriberClient.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  /**
   * Subscribe to a Redis channel
   */
  async subscribe(channel: string, callback: (message: RedisMessage) => void) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
      await this.subscriberClient.subscribe(channel, (error) => {
        if (error) {
          this.logger.error(`Failed to subscribe to channel ${channel}: ${error.message}`);
        } else {
          this.logger.log(`Subscribed to channel: ${channel}`);
        }
      });
    }

    this.channels.get(channel)!.push(callback);
  }

  /**
   * Unsubscribe from a Redis channel
   */
  async unsubscribe(channel: string, callback?: (message: RedisMessage) => void) {
    if (!this.channels.has(channel)) {
      return;
    }

    if (callback) {
      const handlers = this.channels.get(channel)!;
      const index = handlers.indexOf(callback);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }

    if (!callback || this.channels.get(channel)!.length === 0) {
      await this.subscriberClient.unsubscribe(channel);
      this.channels.delete(channel);
      this.logger.log(`Unsubscribed from channel: ${channel}`);
    }
  }

  /**
   * Publish a message to a Redis channel
   */
  async publish(channel: string, message: RedisMessage): Promise<number> {
    try {
      const messageString = JSON.stringify(message);
      const result = await this.publisherClient.publish(channel, messageString);
      this.logger.log(`Published message to channel ${channel}, subscribers: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Publish to user's notification channel
   */
  async publishToUser(userId: string, data: any) {
    const message: RedisMessage = {
      type: 'user_notification',
      userId,
      data,
      timestamp: Date.now(),
    };
    return this.publish(`notifications:user:${userId}`, message);
  }

  /**
   * Publish to multiple users
   */
  async publishToUsers(userIds: string[], data: any) {
    const promises = userIds.map((userId) => this.publishToUser(userId, data));
    return Promise.all(promises);
  }

  /**
   * Publish to a broadcast channel
   */
  async publishBroadcast(data: any) {
    const message: RedisMessage = {
      type: 'broadcast',
      data,
      timestamp: Date.now(),
    };
    return this.publish('notifications:broadcast', message);
  }

  /**
   * Handle incoming Redis messages
   */
  private handleMessage(channel: string, messageString: string) {
    try {
      const message = JSON.parse(messageString) as RedisMessage;
      const handlers = this.channels.get(channel) || [];

      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(`Error handling message: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse Redis message: ${error.message}`);
    }
  }

  /**
   * Set key-value in Redis with expiration
   */
  async setWithExpiry(key: string, value: any, expirySeconds: number): Promise<void> {
    try {
      const valueString = typeof value === 'string' ? value : JSON.stringify(value);
      await this.publisherClient.setex(key, expirySeconds, valueString);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get value from Redis
   */
  async get(key: string): Promise<any> {
    try {
      const value = await this.publisherClient.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (error) {
      this.logger.error(`Failed to get key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete key from Redis
   */
  async delete(key: string): Promise<void> {
    try {
      await this.publisherClient.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.publisherClient.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check key existence ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async incrementCounter(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.publisherClient.incrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to increment counter ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decrement counter
   */
  async decrementCounter(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.publisherClient.decrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to decrement counter ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add to set
   */
  async addToSet(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.publisherClient.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Failed to add to set ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get set members
   */
  async getSetMembers(key: string): Promise<string[]> {
    try {
      return await this.publisherClient.smembers(key);
    } catch (error) {
      this.logger.error(`Failed to get set members ${key}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.publisherClient.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Close Redis connections
   */
  async close() {
    await this.publisherClient.quit();
    await this.subscriberClient.quit();
    this.logger.log('Redis connections closed');
  }
}
