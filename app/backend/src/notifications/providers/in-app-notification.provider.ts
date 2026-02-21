import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from '../entities/notification.entity';

interface InAppNotificationOptions {
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  actionUrl?: string;
  priority?: 'low' | 'normal' | 'high';
  expiresIn?: number; // in seconds
}

@Injectable()
export class InAppNotificationProvider {
  private readonly logger = new Logger(InAppNotificationProvider.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Store in-app notification in database
   */
  async sendInAppNotification(options: InAppNotificationOptions): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        userId: options.userId,
        type: 'in_app',
        title: options.title,
        message: options.message,
        data: {
          ...options.data,
          priority: options.priority || 'normal',
          actionUrl: options.actionUrl,
        },
        metadata: {
          ...options.metadata,
          expiresIn: options.expiresIn,
        },
      });

      await this.notificationRepository.save(notification);
      this.logger.log(`In-app notification created for user ${options.userId}, ID: ${notification.id}`);
      return notification;
    } catch (error) {
      this.logger.error(`Failed to create in-app notification: ${error.message}`);
      throw new Error(`In-app notification creation failed: ${error.message}`);
    }
  }

  /**
   * Send in-app notifications to multiple users
   */
  async sendInAppNotificationsToUsers(
    userIds: string[],
    title: string,
    message: string,
    options?: Omit<InAppNotificationOptions, 'userId' | 'title' | 'message'>,
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      try {
        const notification = await this.sendInAppNotification({
          userId,
          title,
          message,
          ...options,
        });
        notifications.push(notification);
      } catch (error) {
        this.logger.error(`Failed to send to user ${userId}: ${error.message}`);
      }
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await this.notificationRepository.update(
        { id: notificationId },
        {
          read: true,
          readAt: new Date(),
        },
      );
      this.logger.log(`Notification ${notificationId} marked as read`);
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      await this.notificationRepository.update(
        { userId, read: false },
        {
          read: true,
          readAt: new Date(),
        },
      );
      this.logger.log(`All notifications marked as read for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to mark all as read: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.notificationRepository.count({
        where: {
          userId,
          read: false,
        },
      });
      return count;
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get notifications for user
   */
  async getNotifications(userId: string, limit: number = 20, offset: number = 0): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const [notifications, total] = await this.notificationRepository.findAndCount({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });
      return { notifications, total };
    } catch (error) {
      this.logger.error(`Failed to get notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await this.notificationRepository.delete(notificationId);
      this.logger.log(`Notification ${notificationId} deleted`);
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear old notifications (expired)
   */
  async clearExpiredNotifications(): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

      const result = await this.notificationRepository.delete({
        createdAt: query => query.expression < ':cutoffDate',
      });

      const deletedCount = result.affected || 0;
      this.logger.log(`Cleared ${deletedCount} expired notifications`);
      return deletedCount;
    } catch (error) {
      this.logger.error(`Failed to clear expired notifications: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.notificationRepository.findOne({ where: { id: '' } });
      return true;
    } catch (error) {
      this.logger.error(`In-app notification health check failed: ${error.message}`);
      return false;
    }
  }
}
