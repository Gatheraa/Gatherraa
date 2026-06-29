import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Notification, NotificationType, NotificationCategory, NotificationStatus } from '../entities/notification.entity';
import { DeliveryChannel } from '../entities/notification-delivery.entity';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { DeliveryService } from '../services/delivery.service';
import { PreferencesService } from '../services/preferences.service';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { NOTIFICATION_FANOUT_QUEUE, FANOUT_BATCH_SIZE, FanoutJobData } from './fanout.types';

@Processor(NOTIFICATION_FANOUT_QUEUE)
export class FanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(FanoutProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly deliveryService: DeliveryService,
    private readonly preferencesService: PreferencesService,
    private readonly gateway: NotificationsGateway,
  ) {
    super();
  }

  async process(job: Job<FanoutJobData>): Promise<void> {
    const { recipientIds, topicKey } = job.data;
    this.logger.log(`Fanout job ${job.id} (${topicKey}): fanning out to ${recipientIds.length} recipients`);

    for (let i = 0; i < recipientIds.length; i += FANOUT_BATCH_SIZE) {
      const batch = recipientIds.slice(i, i + FANOUT_BATCH_SIZE);
      await this.processBatch(batch, job.data);
      await job.updateProgress(Math.round(((i + batch.length) / recipientIds.length) * 100));
    }

    this.logger.log(`Fanout job ${job.id} complete`);
  }

  private async processBatch(userIds: string[], payload: FanoutJobData): Promise<void> {
    // One INSERT for the whole batch — eliminates per-row lock contention
    const values = userIds.map(userId => ({
      userId,
      type: payload.type as NotificationType,
      category: payload.category as NotificationCategory,
      title: payload.title,
      message: payload.message,
      templateId: payload.templateId ?? null,
      data: payload.data ?? null,
      status: NotificationStatus.PENDING,
    }));

    const insertResult = await this.notificationRepo
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values(values)
      .execute();

    const ids: string[] = insertResult.identifiers.map((r: { id: string }) => r.id);
    const notifications = await this.notificationRepo.findBy({ id: In(ids) });

    await Promise.allSettled(notifications.map(n => this.deliver(n)));
  }

  private async deliver(notification: Notification): Promise<void> {
    try {
      const preferences = await this.preferencesService.getUserPreferences(notification.userId);

      if (!preferences?.notificationsEnabled) {
        await this.notificationRepo.update(notification.id, {
          status: NotificationStatus.FAILED,
          failureReason: 'Notifications disabled',
        });
        return;
      }

      const channels = this.resolveChannels(preferences, notification.category);

      for (const channel of channels) {
        try {
          await this.deliveryService.sendViaChannel(notification, channel, preferences);
        } catch (err) {
          this.logger.error(`Fanout delivery failed [user=${notification.userId}, channel=${channel}]: ${(err as Error).message}`);
        }
      }

      await this.notificationRepo.update(notification.id, { status: NotificationStatus.SENT });

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
    } catch (err) {
      this.logger.error(`Fanout deliver error [user=${notification.userId}]: ${(err as Error).message}`);
      await this.notificationRepo.update(notification.id, {
        status: NotificationStatus.FAILED,
        failureReason: (err as Error).message,
      });
    }
  }

  private resolveChannels(preferences: NotificationPreferences, category: NotificationCategory): DeliveryChannel[] {
    const categoryKey = this.categoryToKey(category);
    const prefs = preferences?.categoryPreferences?.[categoryKey];
    const channels: DeliveryChannel[] = [];

    if (prefs?.email) channels.push(DeliveryChannel.EMAIL);
    if (prefs?.push) channels.push(DeliveryChannel.PUSH);
    if (prefs?.inApp) channels.push(DeliveryChannel.IN_APP);
    if (prefs?.sms) channels.push(DeliveryChannel.SMS);

    return channels.length > 0 ? channels : [DeliveryChannel.IN_APP];
  }

  private categoryToKey(category: NotificationCategory): string {
    const map: Record<NotificationCategory, string> = {
      [NotificationCategory.EVENT_REMINDER]: 'eventReminder',
      [NotificationCategory.TICKET_SALE]: 'ticketSale',
      [NotificationCategory.REVIEW]: 'review',
      [NotificationCategory.SYSTEM_ALERT]: 'systemAlert',
      [NotificationCategory.MARKETING]: 'marketing',
      [NotificationCategory.INVITATION]: 'invitation',
      [NotificationCategory.COMMENT]: 'comment',
      [NotificationCategory.FOLLOWER]: 'follower',
    };
    return map[category] ?? 'eventReminder';
  }
}
