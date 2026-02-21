import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationDelivery, DeliveryChannel, DeliveryStatus } from '../entities/notification-delivery.entity';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { EmailNotificationProvider } from '../providers/email-notification.provider';
import { PushNotificationProvider } from '../providers/push-notification.provider';
import { InAppNotificationProvider } from '../providers/in-app-notification.provider';
import { TemplateService } from './template.service';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectRepository(NotificationDelivery)
    private deliveryRepository: Repository<NotificationDelivery>,
    private emailProvider: EmailNotificationProvider,
    private pushProvider: PushNotificationProvider,
    private inAppProvider: InAppNotificationProvider,
    private templateService: TemplateService,
  ) {}

  /**
   * Send notification via specified channel
   */
  async sendViaChannel(
    notification: Notification,
    channel: DeliveryChannel,
    preferences: NotificationPreferences,
  ): Promise<NotificationDelivery> {
    try {
      let delivery: NotificationDelivery;

      switch (channel) {
        case DeliveryChannel.EMAIL:
          delivery = await this.sendEmailNotification(notification, preferences);
          break;
        case DeliveryChannel.PUSH:
          delivery = await this.sendPushNotification(notification, preferences);
          break;
        case DeliveryChannel.IN_APP:
          delivery = await this.sendInAppNotification(notification, preferences);
          break;
        case DeliveryChannel.SMS:
          delivery = await this.sendSmsNotification(notification, preferences);
          break;
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }

      return delivery;
    } catch (error) {
      this.logger.error(`Failed to send via ${channel}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: Notification,
    preferences: NotificationPreferences,
  ): Promise<NotificationDelivery> {
    try {
      const email = preferences?.primaryEmail;

      if (!email) {
        throw new Error('No email address on file');
      }

      const messageId = await this.emailProvider.sendEmail({
        to: email,
        subject: notification.title,
        html: notification.message,
        replyTo: 'noreply@gatheraa.com',
      });

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.EMAIL,
        status: DeliveryStatus.SENT,
        recipientAddress: email,
        sentAt: new Date(),
        providerMessageId: messageId,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.EMAIL,
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    notification: Notification,
    preferences: NotificationPreferences,
  ): Promise<NotificationDelivery> {
    try {
      const deviceTokens = preferences?.deviceTokens || [];

      if (deviceTokens.length === 0) {
        throw new Error('No device tokens available');
      }

      await this.pushProvider.sendPushNotification({
        title: notification.title,
        body: notification.message,
        deviceTokens,
        data: notification.data,
      });

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.PUSH,
        status: DeliveryStatus.SENT,
        sentAt: new Date(),
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to send push: ${error.message}`);

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.PUSH,
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(
    notification: Notification,
    preferences: NotificationPreferences,
  ): Promise<NotificationDelivery> {
    try {
      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
        sentAt: new Date(),
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to send in-app: ${error.message}`);

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(
    notification: Notification,
    preferences: NotificationPreferences,
  ): Promise<NotificationDelivery> {
    try {
      const phoneNumber = preferences?.phoneNumber;

      if (!phoneNumber) {
        throw new Error('No phone number on file');
      }

      // TODO: Integrate with SMS provider (Twilio, etc.)
      this.logger.log(`SMS notification would be sent to ${phoneNumber}`);

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.SMS,
        status: DeliveryStatus.QUEUED,
        recipientAddress: phoneNumber,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);

      const delivery = this.deliveryRepository.create({
        notificationId: notification.id,
        userId: notification.userId,
        channel: DeliveryChannel.SMS,
        status: DeliveryStatus.FAILED,
        errorMessage: error.message,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      });

      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(deliveryId: string, status: DeliveryStatus): Promise<NotificationDelivery> {
    try {
      const delivery = await this.deliveryRepository.findOne({ where: { id: deliveryId } });

      if (!delivery) {
        throw new Error('Delivery not found');
      }

      delivery.status = status;

      if (status === DeliveryStatus.DELIVERED) {
        delivery.deliveredAt = new Date();
      } else if (status === DeliveryStatus.OPENED) {
        delivery.openedAt = new Date();
      } else if (status === DeliveryStatus.CLICKED) {
        delivery.clickedAt = new Date();
      }

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to update delivery status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry failed delivery
   */
  async retryDelivery(deliveryId: string): Promise<NotificationDelivery> {
    try {
      const delivery = await this.deliveryRepository.findOne({ where: { id: deliveryId } });

      if (!delivery) {
        throw new Error('Delivery not found');
      }

      delivery.attemptCount++;
      delivery.lastAttemptAt = new Date();
      delivery.status = DeliveryStatus.QUEUED;

      await this.deliveryRepository.save(delivery);
      return delivery;
    } catch (error) {
      this.logger.error(`Failed to retry delivery: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(
    notificationId: string,
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    clicked: number;
  }> {
    try {
      const deliveries = await this.deliveryRepository.find({
        where: { notificationId },
      });

      return {
        total: deliveries.length,
        sent: deliveries.filter((d) => d.status === DeliveryStatus.SENT).length,
        delivered: deliveries.filter((d) => d.status === DeliveryStatus.DELIVERED).length,
        failed: deliveries.filter((d) => d.status === DeliveryStatus.FAILED).length,
        opened: deliveries.filter((d) => d.status === DeliveryStatus.OPENED).length,
        clicked: deliveries.filter((d) => d.status === DeliveryStatus.CLICKED).length,
      };
    } catch (error) {
      this.logger.error(`Failed to get delivery stats: ${error.message}`);
      throw error;
    }
  }
}
