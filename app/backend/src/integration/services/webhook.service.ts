import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { WebhookEvent, WebhookEventType, WebhookStatus } from '../entities/webhook-event.entity';
import { Integration } from '../entities/integration.entity';
import { IntegrationLog, LogLevel, LogCategory } from '../entities/integration-log.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(IntegrationLog)
    private readonly logRepository: Repository<IntegrationLog>,
  ) {}

  async createWebhookEvent(
    integrationId: string,
    eventType: WebhookEventType,
    payload: any,
    endpointUrl: string,
    eventSource?: string,
  ): Promise<WebhookEvent> {
    this.logger.log(`Creating webhook event for integration ${integrationId}: ${eventType}`);

    const webhookEvent = this.webhookEventRepository.create({
      integrationId,
      eventType,
      eventSource: eventSource || 'gatheraa',
      payload,
      endpointUrl,
      status: WebhookStatus.PENDING,
      requestId: this.generateRequestId(),
    });

    const savedEvent = await this.webhookEventRepository.save(webhookEvent);

    // Log webhook creation
    await this.logWebhookEvent(
      integrationId,
      LogLevel.INFO,
      LogCategory.WEBHOOK,
      `Webhook event created: ${eventType}`,
      { eventId: savedEvent.id, eventType, endpointUrl }
    );

    // Trigger processing asynchronously
    this.processWebhookEvent(savedEvent.id).catch(error => {
      this.logger.error(`Failed to process webhook event ${savedEvent.id}: ${error.message}`);
    });

    return savedEvent;
  }

  async processWebhookEvent(eventId: string): Promise<void> {
    this.logger.log(`Processing webhook event: ${eventId}`);

    const event = await this.webhookEventRepository.findOne({ where: { id: eventId } });
    
    if (!event) {
      this.logger.error(`Webhook event not found: ${eventId}`);
      return;
    }

    if (event.status !== WebhookStatus.PENDING && event.status !== WebhookStatus.RETRYING) {
      this.logger.log(`Webhook event ${eventId} is not in a processable state: ${event.status}`);
      return;
    }

    try {
      event.status = WebhookStatus.PROCESSING;
      await this.webhookEventRepository.save(event);

      const startTime = Date.now();
      const result = await this.deliverWebhook(event);
      const duration = Date.now() - startTime;

      if (result.success) {
        event.status = WebhookStatus.COMPLETED;
        event.isDelivered = true;
        event.deliveredAt = new Date();
        event.responseCode = result.statusCode;
        event.responseBody = result.responseBody;
        event.processingDuration = duration;

        await this.logWebhookEvent(
          event.integrationId,
          LogLevel.INFO,
          LogCategory.WEBHOOK,
          `Webhook delivered successfully: ${event.eventType}`,
          { eventId: event.id, duration, statusCode: result.statusCode }
        );
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      event.retryCount++;
      event.errorMessage = error.message;
      event.lastRetryAt = new Date();

      if (event.retryCount >= event.maxRetries) {
        event.status = WebhookStatus.FAILED;
        
        await this.logWebhookEvent(
          event.integrationId,
          LogLevel.ERROR,
          LogCategory.WEBHOOK,
          `Webhook delivery failed after ${event.retryCount} retries: ${error.message}`,
          { eventId: event.id, retryCount: event.retryCount }
        );
      } else {
        event.status = WebhookStatus.RETRYING;
        event.nextRetryAt = this.calculateNextRetryTime(event.retryCount);
        
        await this.logWebhookEvent(
          event.integrationId,
          LogLevel.WARN,
          LogCategory.WEBHOOK,
          `Webhook delivery failed, scheduling retry ${event.retryCount}/${event.maxRetries}: ${error.message}`,
          { eventId: event.id, nextRetryAt: event.nextRetryAt }
        );

        // Schedule retry
        this.scheduleRetry(event.id, event.nextRetryAt);
      }
    }

    await this.webhookEventRepository.save(event);
  }

  async retryFailedWebhook(eventId: string): Promise<void> {
    const event = await this.webhookEventRepository.findOne({ where: { id: eventId } });
    
    if (!event) {
      throw new Error(`Webhook event not found: ${eventId}`);
    }

    if (event.status !== WebhookStatus.FAILED) {
      throw new Error(`Cannot retry webhook event in status: ${event.status}`);
    }

    event.status = WebhookStatus.PENDING;
    event.retryCount = 0;
    event.errorMessage = null;
    event.nextRetryAt = null;

    await this.webhookEventRepository.save(event);

    await this.processWebhookEvent(eventId);
  }

  async getWebhookEvents(filters?: {
    integrationId?: string;
    eventType?: WebhookEventType;
    status?: WebhookStatus;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ events: WebhookEvent[]; total: number }> {
    const { integrationId, eventType, status, startDate, endDate, page = 1, limit = 20 } = filters || {};

    const where: any = {};
    if (integrationId) where.integrationId = integrationId;
    if (eventType) where.eventType = eventType;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = { $gte: startDate, $lte: endDate };
    }

    const [events, total] = await this.webhookEventRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { events, total };
  }

  async getWebhookStats(integrationId?: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    processing: number;
    retrying: number;
  }> {
    const where: any = integrationId ? { integrationId } : {};

    const [total, delivered, failed, pending, processing, retrying] = await Promise.all([
      this.webhookEventRepository.count({ where }),
      this.webhookEventRepository.count({ where: { ...where, status: WebhookStatus.COMPLETED } }),
      this.webhookEventRepository.count({ where: { ...where, status: WebhookStatus.FAILED } }),
      this.webhookEventRepository.count({ where: { ...where, status: WebhookStatus.PENDING } }),
      this.webhookEventRepository.count({ where: { ...where, status: WebhookStatus.PROCESSING } }),
      this.webhookEventRepository.count({ where: { ...where, status: WebhookStatus.RETRYING } }),
    ]);

    return {
      total,
      delivered,
      failed,
      pending,
      processing,
      retrying,
    };
  }

  async cleanupOldWebhookEvents(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.webhookEventRepository.delete({
      createdAt: LessThan(cutoffDate),
      status: WebhookStatus.COMPLETED,
    });

    this.logger.log(`Cleaned up ${result.affected} old webhook events`);
    return result.affected || 0;
  }

  async processPendingRetries(): Promise<void> {
    const pendingRetries = await this.webhookEventRepository.find({
      where: {
        status: WebhookStatus.RETRYING,
        nextRetryAt: LessThan(new Date()),
      },
    });

    this.logger.log(`Processing ${pendingRetries.length} pending webhook retries`);

    for (const event of pendingRetries) {
      this.processWebhookEvent(event.id).catch(error => {
        this.logger.error(`Failed to process webhook retry ${event.id}: ${error.message}`);
      });
    }
  }

  private async deliverWebhook(event: WebhookEvent): Promise<{ success: boolean; statusCode?: number; responseBody?: string; error?: string }> {
    try {
      const fetch = require('node-fetch');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Gatheraa-Webhook/1.0',
        'X-Webhook-Event': event.eventType,
        'X-Webhook-ID': event.id,
        'X-Event-Source': event.eventSource,
      };

      // Add signature if secret is configured
      if (event.secretKey) {
        const crypto = require('crypto');
        const payload = JSON.stringify(event.payload);
        const signature = crypto
          .createHmac('sha256', event.secretKey)
          .update(payload)
          .digest('hex');
        
        headers['X-Webhook-Signature'] = `sha256=${signature}`;
      }

      const response = await fetch(event.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(event.payload),
        timeout: 30000, // 30 seconds timeout
      });

      const responseBody = await response.text();

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody,
        };
      } else {
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private calculateNextRetryTime(retryCount: number): Date {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    
    return new Date(Date.now() + exponentialDelay + jitter);
  }

  private scheduleRetry(eventId: string, retryAt: Date): void {
    const delay = retryAt.getTime() - Date.now();
    
    if (delay <= 0) {
      // Retry immediately if the time has passed
      this.processWebhookEvent(eventId).catch(error => {
        this.logger.error(`Failed to process immediate webhook retry ${eventId}: ${error.message}`);
      });
    } else {
      // Schedule retry for the future
      setTimeout(() => {
        this.processWebhookEvent(eventId).catch(error => {
          this.logger.error(`Failed to process scheduled webhook retry ${eventId}: ${error.message}`);
        });
      }, delay);
    }
  }

  private async logWebhookEvent(
    integrationId: string,
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const log = this.logRepository.create({
      integrationId,
      level,
      category,
      message,
      metadata,
    });

    await this.logRepository.save(log);
  }

  private generateRequestId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
