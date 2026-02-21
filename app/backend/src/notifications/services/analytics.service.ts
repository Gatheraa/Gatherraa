import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationAnalytics } from '../entities/notification-analytics.entity';
import { DeliveryChannel } from '../entities/notification-delivery.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(NotificationAnalytics)
    private analyticsRepository: Repository<NotificationAnalytics>,
  ) {}

  /**
   * Log notification sent
   */
  async logNotificationSent(notification: Notification, channels: DeliveryChannel[]): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const channel of channels) {
        let analytics = await this.analyticsRepository.findOne({
          where: {
            date: today,
            category: notification.category,
            channel: channel,
          },
        });

        if (!analytics) {
          analytics = this.analyticsRepository.create({
            date: today,
            category: notification.category,
            channel: channel,
            totalSent: 0,
            totalDelivered: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalFailed: 0,
            totalBounced: 0,
          });
        }

        analytics.totalSent++;
        await this.analyticsRepository.save(analytics);
      }

      this.logger.log(`Analytics logged for notification ${notification.id}`);
    } catch (error) {
      this.logger.error(`Failed to log notification sent: ${error.message}`);
    }
  }

  /**
   * Log bulk notification sent
   */
  async logBulkNotificationSent(category: string, count: number): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let analytics = await this.analyticsRepository.findOne({
        where: {
          date: today,
          category: category,
        },
      });

      if (!analytics) {
        analytics = this.analyticsRepository.create({
          date: today,
          category: category,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalFailed: 0,
          totalBounced: 0,
        });
      }

      analytics.totalSent += count;
      await this.analyticsRepository.save(analytics);

      this.logger.log(`Bulk analytics logged: ${count} notifications`);
    } catch (error) {
      this.logger.error(`Failed to log bulk notification: ${error.message}`);
    }
  }

  /**
   * Track notification read
   */
  async trackNotificationRead(notification: Notification): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let analytics = await this.analyticsRepository.findOne({
        where: {
          date: today,
          category: notification.category,
        },
      });

      if (!analytics) {
        analytics = this.analyticsRepository.create({
          date: today,
          category: notification.category,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalFailed: 0,
          totalBounced: 0,
        });
      }

      analytics.totalOpened++;
      analytics.openRate = (analytics.totalOpened / analytics.totalSent) * 100;

      await this.analyticsRepository.save(analytics);
    } catch (error) {
      this.logger.error(`Failed to track read: ${error.message}`);
    }
  }

  /**
   * Track notification click
   */
  async trackNotificationClick(notificationId: string): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let analytics = await this.analyticsRepository.findOne({
        where: {
          date: today,
        },
      });

      if (!analytics) {
        analytics = this.analyticsRepository.create({
          date: today,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalFailed: 0,
          totalBounced: 0,
        });
      }

      analytics.totalClicked++;
      analytics.clickRate = (analytics.totalClicked / analytics.totalSent) * 100;

      await this.analyticsRepository.save(analytics);
    } catch (error) {
      this.logger.error(`Failed to track click: ${error.message}`);
    }
  }

  /**
   * Track delivery failure
   */
  async trackDeliveryFailure(notification: Notification): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let analytics = await this.analyticsRepository.findOne({
        where: {
          date: today,
          category: notification.category,
        },
      });

      if (!analytics) {
        analytics = this.analyticsRepository.create({
          date: today,
          category: notification.category,
          totalSent: 0,
          totalDelivered: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalFailed: 0,
          totalBounced: 0,
        });
      }

      analytics.totalFailed++;
      analytics.failureRate = (analytics.totalFailed / analytics.totalSent) * 100;

      await this.analyticsRepository.save(analytics);
    } catch (error) {
      this.logger.error(`Failed to track failure: ${error.message}`);
    }
  }

  /**
   * Get analytics for date range
   */
  async getAnalytics(
    dateFrom: Date,
    dateTo: Date,
    category?: string,
    channel?: DeliveryChannel,
  ): Promise<NotificationAnalytics[]> {
    try {
      const query = this.analyticsRepository.createQueryBuilder('analytics').where('analytics.date >= :dateFrom AND analytics.date <= :dateTo', {
        dateFrom,
        dateTo,
      });

      if (category) {
        query.andWhere('analytics.category = :category', { category });
      }

      if (channel) {
        query.andWhere('analytics.channel = :channel', { channel });
      }

      return await query.orderBy('analytics.date', 'DESC').getMany();
    } catch (error) {
      this.logger.error(`Failed to get analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(dateFrom: Date, dateTo: Date): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalFailed: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  }> {
    try {
      const analytics = await this.getAnalytics(dateFrom, dateTo);

      const summary = {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalFailed: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
      };

      for (const stat of analytics) {
        summary.totalSent += stat.totalSent;
        summary.totalDelivered += stat.totalDelivered;
        summary.totalOpened += stat.totalOpened;
        summary.totalClicked += stat.totalClicked;
        summary.totalFailed += stat.totalFailed;
      }

      summary.deliveryRate = summary.totalSent > 0 ? (summary.totalDelivered / summary.totalSent) * 100 : 0;
      summary.openRate = summary.totalDelivered > 0 ? (summary.totalOpened / summary.totalDelivered) * 100 : 0;
      summary.clickRate = summary.totalOpened > 0 ? (summary.totalClicked / summary.totalOpened) * 100 : 0;

      return summary;
    } catch (error) {
      this.logger.error(`Failed to get summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(
    dateFrom: Date,
    dateTo: Date,
  ): Promise<{ category: string; totalSent: number; totalDelivered: number; totalOpened: number; openRate: number }[]> {
    try {
      const analytics = await this.analyticsRepository
        .createQueryBuilder('analytics')
        .where('analytics.date >= :dateFrom AND analytics.date <= :dateTo', { dateFrom, dateTo })
        .groupBy('analytics.category')
        .select('analytics.category', 'category')
        .addSelect('SUM(analytics.totalSent)', 'totalSent')
        .addSelect('SUM(analytics.totalDelivered)', 'totalDelivered')
        .addSelect('SUM(analytics.totalOpened)', 'totalOpened')
        .getRawMany();

      return analytics.map((stat) => ({
        category: stat.category,
        totalSent: parseInt(stat.totalSent) || 0,
        totalDelivered: parseInt(stat.totalDelivered) || 0,
        totalOpened: parseInt(stat.totalOpened) || 0,
        openRate: parseInt(stat.totalSent) > 0 ? (parseInt(stat.totalOpened) / parseInt(stat.totalSent)) * 100 : 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to get category breakdown: ${error.message}`);
      throw error;
    }
  }
}
