import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdvancedCacheService } from './advanced-cache.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface CacheWarmupConfig {
  key: string;
  query: () => Promise<any>;
  ttl: number;
  priority: 'low' | 'medium' | 'high';
  refreshInterval?: string; // Cron expression
}

export interface WarmupStats {
  totalKeys: number;
  successfulWarmed: number;
  failedWarmed: number;
  lastWarmupTime: Date;
  averageWarmupTime: number;
}

@Injectable()
export class CacheWarmupService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmupService.name);
  private warmupConfigs: Map<string, CacheWarmupConfig> = new Map();
  private stats: WarmupStats = {
    totalKeys: 0,
    successfulWarmed: 0,
    failedWarmed: 0,
    lastWarmupTime: new Date(),
    averageWarmupTime: 0
  };

  constructor(
    private cacheService: AdvancedCacheService,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Event) private eventRepository: Repository<Event>,
    @InjectRepository(Category) private categoryRepository: Repository<Category>,
  ) {}

  async onModuleInit() {
    await this.initializeDefaultWarmupConfigs();
    await this.performInitialWarmup();
  }

  /**
   * Register a cache warmup configuration
   */
  registerWarmupConfig(config: CacheWarmupConfig): void {
    this.warmupConfigs.set(config.key, config);
    this.logger.log(`Registered warmup config: ${config.key}`);
  }

  /**
   * Perform initial cache warmup
   */
  async performInitialWarmup(): Promise<void> {
    this.logger.log('Starting initial cache warmup...');
    const startTime = Date.now();

    for (const [key, config] of this.warmupConfigs) {
      try {
        await this.warmupKey(config);
        this.stats.successfulWarmed++;
      } catch (error) {
        this.logger.error(`Failed to warmup key ${key}: ${error.message}`);
        this.stats.failedWarmed++;
      }
    }

    const duration = Date.now() - startTime;
    this.stats.lastWarmupTime = new Date();
    this.stats.averageWarmupTime = duration / this.warmupConfigs.size;
    this.stats.totalKeys = this.warmupConfigs.size;

    this.logger.log(`Cache warmup completed in ${duration}ms. Success: ${this.stats.successfulWarmed}, Failed: ${this.stats.failedWarmed}`);
  }

  /**
   * Warmup a specific key
   */
  async warmupKey(config: CacheWarmupConfig): Promise<void> {
    const startTime = Date.now();
    const data = await config.query();
    const duration = Date.now() - startTime;

    await this.cacheService.set(config.key, data, {
      ttl: config.ttl,
      priority: config.priority
    });

    this.logger.debug(`Warmed up key ${config.key} in ${duration}ms`);
  }

  /**
   * Warmup user-related data
   */
  async warmupUserData(userId: string): Promise<void> {
    try {
      // Warm up user profile
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['preferences', 'roles']
      });

      if (user) {
        await this.cacheService.set(`user:${userId}`, user, { ttl: 3600, priority: 'high' });
      }

      // Warm up user notifications
      const notifications = await this.getRecentNotifications(userId);
      await this.cacheService.set(`user:${userId}:notifications`, notifications, { ttl: 300, priority: 'medium' });

      // Warm up user activity
      const activity = await this.getUserActivity(userId);
      await this.cacheService.set(`user:${userId}:activity`, activity, { ttl: 600, priority: 'medium' });

    } catch (error) {
      this.logger.error(`Failed to warmup user data for ${userId}: ${error.message}`);
    }
  }

  /**
   * Warmup event data
   */
  async warmupEventData(eventId: string): Promise<void> {
    try {
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
        relations: ['organizer', 'category', 'tags', 'participants']
      });

      if (event) {
        await this.cacheService.set(`event:${eventId}`, event, { ttl: 1800, priority: 'high' });
      }

      // Warm up related events
      const relatedEvents = await this.getRelatedEvents(eventId);
      await this.cacheService.set(`event:${eventId}:related`, relatedEvents, { ttl: 3600, priority: 'medium' });

    } catch (error) {
      this.logger.error(`Failed to warmup event data for ${eventId}: ${error.message}`);
    }
  }

  /**
   * Warmup popular content
   */
  async warmupPopularContent(): Promise<void> {
    try {
      // Popular events
      const popularEvents = await this.getPopularEvents();
      await this.cacheService.set('events:popular', popularEvents, { ttl: 1800, priority: 'high' });

      // Trending categories
      const trendingCategories = await this.getTrendingCategories();
      await this.cacheService.set('categories:trending', trendingCategories, { ttl: 3600, priority: 'medium' });

      // Featured content
      const featuredContent = await this.getFeaturedContent();
      await this.cacheService.set('content:featured', featuredContent, { ttl: 7200, priority: 'high' });

    } catch (error) {
      this.logger.error(`Failed to warmup popular content: ${error.message}`);
    }
  }

  /**
   * Scheduled warmup for high-priority keys
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledHighPriorityWarmup(): Promise<void> {
    const highPriorityConfigs = Array.from(this.warmupConfigs.values())
      .filter(config => config.priority === 'high');

    for (const config of highPriorityConfigs) {
      try {
        await this.warmupKey(config);
      } catch (error) {
        this.logger.error(`Scheduled warmup failed for ${config.key}: ${error.message}`);
      }
    }
  }

  /**
   * Scheduled warmup for medium-priority keys
   */
  @Cron(CronExpression.EVERY_15_MINUTES)
  async scheduledMediumPriorityWarmup(): Promise<void> {
    const mediumPriorityConfigs = Array.from(this.warmupConfigs.values())
      .filter(config => config.priority === 'medium');

    for (const config of mediumPriorityConfigs) {
      try {
        await this.warmupKey(config);
      } catch (error) {
        this.logger.error(`Scheduled warmup failed for ${config.key}: ${error.message}`);
      }
    }
  }

  /**
   * Scheduled warmup for low-priority keys
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledLowPriorityWarmup(): Promise<void> {
    const lowPriorityConfigs = Array.from(this.warmupConfigs.values())
      .filter(config => config.priority === 'low');

    for (const config of lowPriorityConfigs) {
      try {
        await this.warmupKey(config);
      } catch (error) {
        this.logger.error(`Scheduled warmup failed for ${config.key}: ${error.message}`);
      }
    }
  }

  /**
   * Get warmup statistics
   */
  getWarmupStats(): WarmupStats {
    return { ...this.stats };
  }

  /**
   * Initialize default warmup configurations
   */
  private async initializeDefaultWarmupConfigs(): Promise<void> {
    // User-related warmups
    this.registerWarmupConfig({
      key: 'users:active',
      query: () => this.getActiveUsers(),
      ttl: 1800,
      priority: 'high',
      refreshInterval: CronExpression.EVERY_5_MINUTES
    });

    // Event-related warmups
    this.registerWarmupConfig({
      key: 'events:upcoming',
      query: () => this.getUpcomingEvents(),
      ttl: 600,
      priority: 'high',
      refreshInterval: CronExpression.EVERY_5_MINUTES
    });

    // Category warmups
    this.registerWarmupConfig({
      key: 'categories:popular',
      query: () => this.getPopularCategories(),
      ttl: 3600,
      priority: 'medium',
      refreshInterval: CronExpression.EVERY_15_MINUTES
    });

    // System configuration warmups
    this.registerWarmupConfig({
      key: 'system:config',
      query: () => this.getSystemConfig(),
      ttl: 7200,
      priority: 'high',
      refreshInterval: CronExpression.EVERY_HOUR
    });

    // Analytics warmups
    this.registerWarmupConfig({
      key: 'analytics:summary',
      query: () => this.getAnalyticsSummary(),
      ttl: 300,
      priority: 'medium',
      refreshInterval: CronExpression.EVERY_5_MINUTES
    });
  }

  // Helper methods for data fetching
  private async getActiveUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { isActive: true },
      take: 100,
      order: { lastLoginAt: 'DESC' }
    });
  }

  private async getUpcomingEvents(): Promise<Event[]> {
    const now = new Date();
    return this.eventRepository.find({
      where: { startDate: MoreThan(now) },
      take: 50,
      order: { startDate: 'ASC' },
      relations: ['organizer', 'category']
    });
  }

  private async getPopularCategories(): Promise<Category[]> {
    return this.categoryRepository.find({
      take: 20,
      order: { eventCount: 'DESC' }
    });
  }

  private async getSystemConfig(): Promise<any> {
    // Return system configuration
    return {
      maintenance: false,
      features: {
        notifications: true,
        analytics: true,
        payments: true
      }
    };
  }

  private async getAnalyticsSummary(): Promise<any> {
    // Return analytics summary
    return {
      totalUsers: 0,
      totalEvents: 0,
      activeUsers: 0,
      revenue: 0
    };
  }

  private async getRecentNotifications(userId: string): Promise<any[]> {
    // Get recent notifications for user
    return [];
  }

  private async getUserActivity(userId: string): Promise<any> {
    // Get user activity
    return {
      events: [],
      interactions: []
    };
  }

  private async getRelatedEvents(eventId: string): Promise<Event[]> {
    // Get related events
    return this.eventRepository.find({
      where: { id: Not(eventId) },
      take: 10,
      order: { createdAt: 'DESC' }
    });
  }

  private async getPopularEvents(): Promise<Event[]> {
    // Get popular events
    return this.eventRepository.find({
      take: 20,
      order: { participantCount: 'DESC' },
      relations: ['organizer', 'category']
    });
  }

  private async getTrendingCategories(): Promise<Category[]> {
    // Get trending categories
    return this.categoryRepository.find({
      take: 10,
      order: { trendingScore: 'DESC' }
    });
  }

  private async getFeaturedContent(): Promise<any> {
    // Get featured content
    return {
      events: [],
      categories: [],
      users: []
    };
  }
}
