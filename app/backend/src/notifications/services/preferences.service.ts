import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { UpdateNotificationPreferencesDto } from '../dto';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  private readonly CACHE_PREFIX = 'notification_preferences:';
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour

  constructor(
    @InjectRepository(NotificationPreferences)
    private preferencesRepository: Repository<NotificationPreferences>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;

      // Try cache first
      const cached = await this.cacheManager.get<NotificationPreferences>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get from database
      let preferences = await this.preferencesRepository.findOne({
        where: { userId },
      });

      // Create default preferences if not exist
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      // Cache the result
      await this.cacheManager.set(cacheKey, preferences, this.CACHE_TTL);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to get user preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create default preferences for user
   */
  async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = this.preferencesRepository.create({
        userId,
        notificationsEnabled: true,
        defaultChannels: {
          email: true,
          push: true,
          inApp: true,
          sms: false,
        },
        categoryPreferences: {
          eventReminder: { email: true, push: true, inApp: true, sms: false },
          ticketSale: { email: true, push: true, inApp: true, sms: false },
          review: { email: true, push: false, inApp: true, sms: false },
          systemAlert: { email: true, push: true, inApp: true, sms: true },
          marketing: { email: false, push: false, inApp: true, sms: false },
          invitation: { email: true, push: true, inApp: true, sms: false },
          comment: { email: false, push: true, inApp: true, sms: false },
          follower: { email: false, push: false, inApp: true, sms: false },
        },
        frequency: 'immediate',
        language: 'en-US',
        timezone: 'UTC',
      });

      await this.preferencesRepository.save(preferences);
      this.logger.log(`Default preferences created for user ${userId}`);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to create default preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, dto: UpdateNotificationPreferencesDto): Promise<NotificationPreferences> {
    try {
      let preferences = await this.preferencesRepository.findOne({
        where: { userId },
      });

      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      // Update fields
      if (dto.notificationsEnabled !== undefined) {
        preferences.notificationsEnabled = dto.notificationsEnabled;
      }

      if (dto.defaultChannels) {
        preferences.defaultChannels = {
          ...preferences.defaultChannels,
          ...dto.defaultChannels,
        };
      }

      if (dto.categoryPreferences) {
        preferences.categoryPreferences = {
          ...preferences.categoryPreferences,
          ...dto.categoryPreferences,
        };
      }

      if (dto.quietHours) {
        preferences.quietHours = dto.quietHours;
      }

      if (dto.frequency) {
        preferences.frequency = dto.frequency;
      }

      if (dto.pushEnabled !== undefined) {
        preferences.pushEnabled = dto.pushEnabled;
      }

      if (dto.fcmToken) {
        preferences.fcmToken = dto.fcmToken;
      }

      if (dto.primaryEmail) {
        preferences.primaryEmail = dto.primaryEmail;
      }

      if (dto.phoneNumber) {
        preferences.phoneNumber = dto.phoneNumber;
      }

      if (dto.language) {
        preferences.language = dto.language;
      }

      if (dto.timezone) {
        preferences.timezone = dto.timezone;
      }

      if (dto.unsubscribedCategories) {
        preferences.unsubscribedCategories = dto.unsubscribedCategories;
      }

      if (dto.unsubscribedFromAll !== undefined) {
        preferences.unsubscribedFromAll = dto.unsubscribedFromAll;
      }

      await this.preferencesRepository.save(preferences);

      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.cacheManager.del(cacheKey);

      this.logger.log(`Preferences updated for user ${userId}`);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to update preferences: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add device token for push notifications
   */
  async addDeviceToken(userId: string, deviceToken: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.deviceTokens) {
        preferences.deviceTokens = [];
      }

      // Avoid duplicates
      if (!preferences.deviceTokens.includes(deviceToken)) {
        preferences.deviceTokens.push(deviceToken);
        await this.preferencesRepository.save(preferences);

        // Invalidate cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheManager.del(cacheKey);
      }

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to add device token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove device token
   */
  async removeDeviceToken(userId: string, deviceToken: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (preferences.deviceTokens) {
        preferences.deviceTokens = preferences.deviceTokens.filter((token) => token !== deviceToken);
        await this.preferencesRepository.save(preferences);

        // Invalidate cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheManager.del(cacheKey);
      }

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to remove device token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from category
   */
  async unsubscribeFromCategory(userId: string, category: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.unsubscribedCategories) {
        preferences.unsubscribedCategories = [];
      }

      if (!preferences.unsubscribedCategories.includes(category)) {
        preferences.unsubscribedCategories.push(category);
        await this.preferencesRepository.save(preferences);

        // Invalidate cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheManager.del(cacheKey);
      }

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`);
      throw error;
    }
  }

  /**
   * Subscribe to category
   */
  async subscribeToCategory(userId: string, category: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (preferences.unsubscribedCategories) {
        preferences.unsubscribedCategories = preferences.unsubscribedCategories.filter((c) => c !== category);
        await this.preferencesRepository.save(preferences);

        // Invalidate cache
        const cacheKey = `${this.CACHE_PREFIX}${userId}`;
        await this.cacheManager.del(cacheKey);
      }

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to subscribe: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unsubscribe from all notifications
   */
  async unsubscribeFromAll(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.unsubscribedFromAll = true;

      await this.preferencesRepository.save(preferences);

      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.cacheManager.del(cacheKey);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from all: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify email address for user
   */
  async verifyEmailAddress(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.emailVerified = true;

      await this.preferencesRepository.save(preferences);

      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.cacheManager.del(cacheKey);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to verify email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify phone number for user
   */
  async verifyPhoneNumber(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.phoneVerified = true;

      await this.preferencesRepository.save(preferences);

      // Invalidate cache
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.cacheManager.del(cacheKey);

      return preferences;
    } catch (error) {
      this.logger.error(`Failed to verify phone: ${error.message}`);
      throw error;
    }
  }
}
