import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../entities/webhook.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { WebhookEventType, WebhookDeliveryStatus } from '../constants/webhook.constants';
import * as crypto from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    @InjectQueue('webhooks')
    private readonly webhookQueue: Queue,
  ) {}

  async create(createDto: CreateWebhookDto, userId?: string): Promise<Webhook> {
    const secret = createDto.secret || crypto.randomBytes(32).toString('hex');
    const webhook = this.webhookRepository.create({
      ...createDto,
      secret,
      userId,
    });
    return this.webhookRepository.save(webhook);
  }

  async findAll(userId?: string): Promise<Webhook[]> {
    const query = this.webhookRepository.createQueryBuilder('webhook');
    if (userId) {
      query.where('webhook.userId = :userId', { userId });
    }
    return query.getMany();
  }

  async findOne(id: string, userId?: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({ where: { id, userId } });
    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
    return webhook;
  }

  async update(id: string, updateDto: UpdateWebhookDto, userId?: string): Promise<Webhook> {
    const webhook = await this.findOne(id, userId);
    Object.assign(webhook, updateDto);
    return this.webhookRepository.save(webhook);
  }

  async remove(id: string, userId?: string): Promise<void> {
    const webhook = await this.findOne(id, userId);
    await this.webhookRepository.remove(webhook);
  }

  /**
   * Main method to trigger webhooks for an event.
   * This filters webhooks that should receive the event and adds them to the queue.
   */
  async trigger(eventType: WebhookEventType, payload: any, userId?: string): Promise<void> {
    // Find all active webhooks subscribed to this event.
    // Optionally filter by userId if the event is user-specific.
    const query = this.webhookRepository.createQueryBuilder('webhook')
      .where('webhook.isActive = :isActive', { isActive: true })
      .andWhere('webhook.events LIKE :eventType', { eventType: `%${eventType}%` });

    if (userId) {
      query.andWhere('webhook.userId = :userId', { userId });
    }

    const webhooks = await query.getMany();

    const eventId = crypto.randomUUID();

    for (const webhook of webhooks) {
      await this.webhookQueue.add(
        'process-webhook',
        {
          webhookId: webhook.id,
          eventType,
          payload,
          eventId,
        },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }
  }

  async ping(id: string, userId?: string): Promise<any> {
    const webhook = await this.findOne(id, userId);
    const payload = {
      message: 'Hello from Gatherraa!',
      timestamp: new Date().toISOString(),
      pingedAt: new Date(),
    };

    await this.webhookQueue.add(
      'process-webhook',
      {
        webhookId: webhook.id,
        eventType: WebhookEventType.TEST,
        payload,
        eventId: crypto.randomUUID(),
      },
      {
        attempts: 1,
        removeOnComplete: true,
      }
    );

    return { success: true, message: 'Ping event queued' };
  }

  async getDeliveries(webhookId: string, userId?: string, limit = 50): Promise<WebhookDelivery[]> {
    await this.findOne(webhookId, userId); // Verify ownership
    return this.deliveryRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAnalytics(userId?: string): Promise<any> {
    const query = this.deliveryRepository.createQueryBuilder('delivery')
      .innerJoin('delivery.webhook', 'webhook')
      .select('delivery.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (userId) {
      query.where('webhook.userId = :userId', { userId });
    }

    query.groupBy('delivery.status');
    const statusCounts = await query.getRawMany();

    const successes = parseInt(statusCounts.find(s => s.status === WebhookDeliveryStatus.SUCCESS)?.count || '0');
    const failures = parseInt(statusCounts.find(s => s.status === WebhookDeliveryStatus.FAILED)?.count || '0');
    const total = successes + failures;

    // Delivery rate by event type
    const eventTypeStats = await this.deliveryRepository.createQueryBuilder('delivery')
      .innerJoin('delivery.webhook', 'webhook')
      .select('delivery.eventType', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where(userId ? 'webhook.userId = :userId' : '1=1', { userId })
      .groupBy('delivery.eventType')
      .getRawMany();

    return {
      overview: {
        total,
        successes,
        failures,
        successRate: total > 0 ? (successes / total) * 100 : 0,
      },
      byEventType: eventTypeStats,
    };
  }
}
