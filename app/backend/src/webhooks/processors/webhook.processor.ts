import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../entities/webhook.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus, WebhookEventType } from '../constants/webhook.constants';
import axios from 'axios';
import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

@Processor('webhooks')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { webhookId, eventType, payload, eventId } = job.data;
    const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });

    if (!webhook || !webhook.isActive) {
      this.logger.warn(`Webhook ${webhookId} not found or inactive, skipping.`);
      return;
    }

    const startTime = new Date();
    const signature = this.generateSignature(webhook.secret, payload);

    const headers = {
      'Content-Type': 'application/json',
      'X-Gatherraa-Signature': signature,
      'X-Gatherraa-Event': eventType,
      'X-Gatherraa-Delivery-ID': eventId,
      'User-Agent': `Gatherraa-Webhook-Service/${webhook.version}`,
    };

    let status = WebhookDeliveryStatus.SUCCESS;
    let statusCode = 0;
    let responseBody = '';
    let errorMessage = '';

    try {
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 10000, // 10s timeout
        validateStatus: (status) => status >= 200 && status < 300,
      });

      statusCode = response.status;
      responseBody = JSON.stringify(response.data).substring(0, 1000); // Limit response size
    } catch (error: any) {
      status = WebhookDeliveryStatus.FAILED;
      if (error.response) {
        statusCode = error.response.status;
        responseBody = JSON.stringify(error.response.data).substring(0, 1000);
      } else {
        errorMessage = error.message;
      }
      this.logger.error(`Webhook delivery failed for ${webhook.id}: ${errorMessage || statusCode}`);
      
      // If we still have retries, throw the error so BullMQ can handle it
      if (job.attemptsMade < (job.opts.attempts || 1)) {
        throw error;
      }
    }

    // Save or update delivery tracking
    await this.deliveryRepository.save({
      webhookId: webhook.id,
      eventType,
      eventId,
      payload,
      status,
      statusCode,
      responseBody,
      attemptCount: job.attemptsMade + 1,
      headers,
      lastAttemptAt: new Date(),
      errorMessage,
    });

    return { success: status === WebhookDeliveryStatus.SUCCESS, statusCode };
  }

  private generateSignature(secret: string, payload: any): string {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }
}
