import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Notification, NotificationType, NotificationCategory, NotificationStatus } from './entities/notification.entity';
import { NotificationPreferences } from './entities/notification-preferences.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationDelivery, DeliveryChannel, DeliveryStatus } from './entities/notification-delivery.entity';
import { NotificationAnalytics } from './entities/notification-analytics.entity';
import {
  CreateNotificationDto,
  SendNotificationDto,
  UpdateNotificationStatusDto,
  NotificationPaginationDto,
  NotificationResponseDto,
  CreateBulkNotificationDto,
  MarkAsReadDto,
} from './dto';
import { RedisAdapterService } from './providers/redis-adapter.service';
import { EmailNotificationProvider } from './providers/email-notification.provider';
import { PushNotificationProvider } from './providers/push-notification.provider';
import { InAppNotificationProvider } from './providers/in-app-notification.provider';
import { NotificationsGateway } from './gateway/notifications.gateway';
import { TemplateService } from './services/template.service';
import { DeliveryService } from './services/delivery.service';
import { AnalyticsService } from './services/analytics.service';
import { PreferencesService } from './services/preferences.service';
import { Review } from '../reviews/entities/review.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly RATE_LIMIT_KEY_PREFIX = 'notification_rate_limit:';
  private readonly DEFAULT_RATE_LIMIT = 100; // notifications per hour
  private readonly DEFAULT_RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreferences)
    private preferencesRepository: Repository<NotificationPreferences>,
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
    @InjectRepository(NotificationAnalytics)
    private analyticsRepository: Repository<NotificationAnalytics>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private redisAdapter: RedisAdapterService,
    private emailProvider: EmailNotificationProvider,
    private pushProvider: PushNotificationProvider,
    private inAppProvider: InAppNotificationProvider,
    private gateway: NotificationsGateway,
    private templateService: TemplateService,
    private deliveryService: DeliveryService,
    private analyticsService: AnalyticsService,
    private preferencesService: PreferencesService,
  ) {}

  /**
   * Notify event organizer of new review
   */
  async sendReviewNotification(review: Review, event: Event): Promise<void> {
    try {
      await this.createAndSendNotification({
        userId: event.organizerId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.REVIEW,
        title: `New Review for "${event.name}"`,
        message: `${review.userId} left a review for your event.`,
        metadata: {
          eventId: event.id,
          reviewId: review.id,
          actionUrl: `/events/${event.id}/reviews/${review.id}`,
        },
        data: {
          rating: review.rating,
          summary: review.summary,
        },
        sendImmediately: true,
      });
    } catch (error) {
      this.logger.error(`Failed to send review notification: ${error.message}`);
    }
  }

  /**
   * Notify moderators of flagged content
   */
  async sendModerationNotification(review: Review, event: Event): Promise<void> {
    try {
      // Get moderator user IDs (you may need to fetch these from your users table with ADMIN role)
      // For now, using a placeholder
      await this.createAndSendNotification({
        userId: event.organizerId, // Change this to moderator user ID
        type: NotificationType.EMAIL,
        category: NotificationCategory.SYSTEM_ALERT,
        title: 'Content Flagged for Review',
        message: `Review ${review.id} has been flagged and requires moderation.`,
        metadata: {
          eventId: event.id,
          reviewId: review.id,
          actionUrl: `/admin/moderation/${review.id}`,
        },
        sendImmediately: true,
      });
    } catch (error) {
      this.logger.error(`Failed to send moderation notification: ${error.message}`);
    }
  }

  /**
   * Notify moderators when report threshold is reached
   */
  async sendReportNotification(review: Review, event: Event, reportCount: number): Promise<void> {
    const threshold = 3;

    if (reportCount >= threshold) {
      try {
        await this.createAndSendNotification({
          userId: event.organizerId, // Change this to moderator user ID
          type: NotificationType.EMAIL,
          category: NotificationCategory.SYSTEM_ALERT,
          title: 'Report Threshold Reached',
          message: `Review ${review.id} has reached ${reportCount} reports and requires immediate attention.`,
          metadata: {
            eventId: event.id,
            reviewId: review.id,
            reportCount,
            actionUrl: `/admin/moderation/${review.id}`,
          },
          sendImmediately: true,
        });
      } catch (error) {
        this.logger.error(`Failed to send report notification: ${error.message}`);
      }
    }
  }

  /**
   * Notify user when their review is moderated
   */
  async sendModerationResultNotification(review: Review, status: string, reason?: string): Promise<void> {
    try {
      const statusMessage =
        status === 'approved'
          ? 'Your review has been approved'
          : status === 'rejected'
            ? 'Your review has been removed'
            : 'Your review status has been updated';

      await this.createAndSendNotification({
        userId: review.userId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.SYSTEM_ALERT,
        title: 'Review Moderation Update',
        message: statusMessage + (reason ? `: ${reason}` : ''),
        data: {
          status,
          reason,
        },
        sendImmediately: true,
      });
    } catch (error) {
      this.logger.error(`Failed to send moderation result notification: ${error.message}`);
    }
  }

  /**
   * Create and send notification
   */
  async createAndSendNotification(dto: CreateNotificationDto): Promise<Notification> {
    try {
      // Check rate limit
      await this.checkRateLimit(dto.userId);

      // Create notification
      const notification = await this.createNotification(dto);

      // Send immediately if requested
      if (dto.sendImmediately !== false && !dto.scheduledFor) {
        await this.sendNotification(notification);
      } else if (dto.scheduledFor) {
        // Schedule for later
        await this.scheduleNotification(notification);
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create and send notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create notification without sending
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        userId: dto.userId,
        type: dto.type,
        category: dto.category,
        title: dto.title,
        message: dto.message,
        templateId: dto.templateId,
        data: dto.data,
        metadata: dto.metadata,
        scheduledFor: dto.scheduledFor,
        status: NotificationStatus.PENDING,
      });

      await this.notificationRepository.save(notification);
      this.logger.log(`Notification created with ID: ${notification.id}`);

      // Publish to Redis for other instances
      await this.redisAdapter.publish(`notifications:created`, {
        type: 'notification_created',
        notificationId: notification.id,
        userId: notification.userId,
        timestamp: Date.now(),
      });

      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send notification to user(s)
   */
  async sendNotification(notification: Notification): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.preferencesService.getUserPreferences(notification.userId);

      // Check if user has disabled notifications
      if (!preferences?.notificationsEnabled) {
        this.logger.log(`Notifications disabled for user ${notification.userId}`);
        await this.updateNotificationStatus(notification.id, { status: NotificationStatus.FAILED, reason: 'User has disabled notifications' });
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        this.logger.log(`User ${notification.userId} is in quiet hours, scheduling for later`);
        return;
      }

      // Get channels to send to based on preferences
      const channels = this.getChannelsFromPreferences(preferences, notification.category);

      // Send via each channel
      for (const channel of channels) {
        try {
          await this.deliveryService.sendViaChannel(notification, channel, preferences);
        } catch (error) {
          this.logger.error(`Failed to send via ${channel}: ${error.message}`);
        }
      }

      // Update notification status
      await this.updateNotificationStatus(notification.id, { status: NotificationStatus.SENT });

      // Notify via WebSocket if in-app
      if (channels.includes(DeliveryChannel.IN_APP)) {
        this.gateway.notifyUser(notification.userId, {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          category: notification.category,
          type: notification.type,
          createdAt: notification.createdAt,
          data: notification.data,
          metadata: notification.metadata,
        });
      }

      // Log analytics
      await this.analyticsService.logNotificationSent(notification, channels);
    } catch (error) {
      this.logger.error(`Failed to send notification ${notification.id}: ${error.message}`);
      await this.updateNotificationStatus(notification.id, {
        status: NotificationStatus.FAILED,
        reason: error.message,
      });
    }
  }

  /**
   * Send notifications to multiple users
   */
  async sendBulkNotifications(dto: CreateBulkNotificationDto): Promise<Notification[]> {
    try {
      const notifications: Notification[] = [];

      for (const userId of dto.userIds) {
        try {
          // Check rate limit
          await this.checkRateLimit(userId);

          const notification = await this.createNotification({
            userId,
            type: dto.types[0] || NotificationType.IN_APP,
            category: dto.category,
            title: dto.title,
            message: dto.message,
            templateId: dto.templateId,
            data: dto.data,
            scheduledFor: dto.scheduledFor,
          });

          notifications.push(notification);

          // Send if not scheduled
          if (!dto.scheduledFor) {
            await this.sendNotification(notification);
          }
        } catch (error) {
          this.logger.error(`Failed to send to user ${userId}: ${error.message}`);
        }
      }

      // Log bulk send
      await this.analyticsService.logBulkNotificationSent(dto.category, notifications.length);

      return notifications;
    } catch (error) {
      this.logger.error(`Failed to send bulk notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Schedule notification for later
   */
  async scheduleNotification(notification: Notification): Promise<void> {
    try {
      const delay = notification.scheduledFor.getTime() - Date.now();

      if (delay > 0) {
        // Store in Redis for delayed delivery
        await this.redisAdapter.setWithExpiry(
          `scheduled_notification:${notification.id}`,
          notification,
          Math.ceil(delay / 1000),
        );

        this.logger.log(`Notification ${notification.id} scheduled for ${notification.scheduledFor}`);
      }
    } catch (error) {
      this.logger.error(`Failed to schedule notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, userId },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      notification.read = true;
      notification.readAt = new Date();
      notification.status = NotificationStatus.READ;

      await this.notificationRepository.save(notification);

      // Track read in analytics
      await this.analyticsService.trackNotificationRead(notification);

      this.logger.log(`Notification ${notificationId} marked as read`);
      return notification;
    } catch (error) {
      this.logger.error(`Failed to mark as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.notificationRepository.update(
        { userId, read: false },
        {
          read: true,
          readAt: new Date(),
          status: NotificationStatus.READ,
        },
      );

      this.logger.log(`Marked ${result.affected} notifications as read for user ${userId}`);
      return result.affected || 0;
    } catch (error) {
      this.logger.error(`Failed to mark all as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      const result = await this.notificationRepository.delete({
        id: notificationId,
        userId,
      });

      if (result.affected === 0) {
        throw new Error('Notification not found');
      }

      this.logger.log(`Notification ${notificationId} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notifications for user with pagination
   */
  async getNotifications(userId: string, dto: NotificationPaginationDto): Promise<{ notifications: NotificationResponseDto[]; total: number }> {
    try {
      const query = this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.userId = :userId', { userId })
        .orderBy('notification.createdAt', 'DESC');

      if (dto.category) {
        query.andWhere('notification.category = :category', { category: dto.category });
      }

      if (dto.status) {
        query.andWhere('notification.status = :status', { status: dto.status });
      }

      if (dto.unreadOnly) {
        query.andWhere('notification.read = false');
      }

      const [notifications, total] = await query
        .skip(dto.offset || 0)
        .take(dto.limit || 20)
        .getManyAndCount();

      return {
        notifications: notifications.map((n) => this.mapToResponseDto(n)),
        total,
      };
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const cacheKey = `unread_count:${userId}`;
      const cached = await this.cacheManager.get<number>(cacheKey);

      if (cached !== undefined) {
        return cached;
      }

      const count = await this.notificationRepository.count({
        where: { userId, read: false },
      });

      // Cache for 1 minute
      await this.cacheManager.set(cacheKey, count, 60 * 1000);

      return count;
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(notificationId: string, dto: UpdateNotificationStatusDto): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOne({ where: { id: notificationId } });

      if (!notification) {
        throw new Error('Notification not found');
      }

      notification.status = dto.status;

      if (dto.status === NotificationStatus.DELIVERED) {
        notification.status = NotificationStatus.DELIVERED;
      } else if (dto.status === NotificationStatus.FAILED) {
        notification.failureReason = dto.reason;
        notification.lastRetriedAt = new Date();
        notification.retryCount++;
      }

      await this.notificationRepository.save(notification);
      return notification;
    } catch (error) {
      this.logger.error(`Failed to update notification status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check rate limit for user
   */
  private async checkRateLimit(userId: string): Promise<void> {
    try {
      const key = `${this.RATE_LIMIT_KEY_PREFIX}${userId}`;
      const current = await this.cacheManager.get<number>(key);

      if ((current || 0) >= this.DEFAULT_RATE_LIMIT) {
        throw new Error(`Rate limit exceeded for user ${userId}`);
      }

      const newCount = (current || 0) + 1;
      await this.cacheManager.set(key, newCount, this.DEFAULT_RATE_LIMIT_WINDOW * 1000);
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if user is in quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences?.quietHours?.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return currentTime >= preferences.quietHours.startTime && currentTime <= preferences.quietHours.endTime;
  }

  /**
   * Get channels based on category preferences
   */
  private getChannelsFromPreferences(preferences: NotificationPreferences, category: NotificationCategory): DeliveryChannel[] {
    const channels: DeliveryChannel[] = [];

    const categoryKey = this.categoryToPreferenceKey(category);
    const categoryPrefs = preferences?.categoryPreferences?.[categoryKey];

    if (categoryPrefs?.email) channels.push(DeliveryChannel.EMAIL);
    if (categoryPrefs?.push) channels.push(DeliveryChannel.PUSH);
    if (categoryPrefs?.inApp) channels.push(DeliveryChannel.IN_APP);
    if (categoryPrefs?.sms) channels.push(DeliveryChannel.SMS);

    return channels.length > 0 ? channels : [DeliveryChannel.IN_APP]; // Default to in-app
  }

  /**
   * Map category to preference key
   */
  private categoryToPreferenceKey(category: NotificationCategory): string {
    const mapping = {
      [NotificationCategory.EVENT_REMINDER]: 'eventReminder',
      [NotificationCategory.TICKET_SALE]: 'ticketSale',
      [NotificationCategory.REVIEW]: 'review',
      [NotificationCategory.SYSTEM_ALERT]: 'systemAlert',
      [NotificationCategory.MARKETING]: 'marketing',
      [NotificationCategory.INVITATION]: 'invitation',
      [NotificationCategory.COMMENT]: 'comment',
      [NotificationCategory.FOLLOWER]: 'follower',
    };

    return mapping[category] || 'eventReminder';
  }

  /**
   * Map to response DTO
   */
  private mapToResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      category: notification.category,
      status: notification.status,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      metadata: notification.metadata,
      data: notification.data,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const redisHealth = await this.redisAdapter.healthCheck();
      const emailHealth = await this.emailProvider.healthCheck();

      this.logger.log(`Health check - Redis: ${redisHealth}, Email: ${emailHealth}`);
      return redisHealth && emailHealth;
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return false;
    }
  }
}
