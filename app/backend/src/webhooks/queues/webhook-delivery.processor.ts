import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { WebhooksService } from '../webhooks.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { WebhookDeliveryAttempt } from '../entities/webhook-delivery-attempt.entity';
import { WebhookEventType } from '../constants/webhook-events.constant';

interface WebhookDeliveryJobData {
    webhookId: string;
    eventType: WebhookEventType;
    payload: Record<string, any>;
    attemptNumber?: number;
}

@Processor('webhook-delivery')
export class WebhookDeliveryProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookDeliveryProcessor.name);

    constructor(
        private readonly webhooksService: WebhooksService,
        @InjectRepository(WebhookSubscription)
        private readonly webhookRepository: Repository<WebhookSubscription>,
        @InjectRepository(WebhookDeliveryAttempt)
        private readonly attemptRepository: Repository<WebhookDeliveryAttempt>,
    ) {
        super();
    }

    async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
        const { webhookId, eventType, payload } = job.data;
        const attemptNumber = job.attemptsMade + 1;

        this.logger.log(
            `Processing delivery attempt ${attemptNumber} for webhook ${webhookId}`,
        );

        // Retrieve webhook with secret
        const webhook = await this.webhookRepository.findOne({
            where: { id: webhookId },
            select: ['id', 'url', 'secret', 'version', 'isActive'],
        });

        if (!webhook || !webhook.isActive) {
            this.logger.warn(`Webhook ${webhookId} not found or inactive, skipping`);
            return;
        }

        // Attempt delivery
        const result = await this.webhooksService.deliverPayload(
            webhook,
            eventType,
            payload,
            attemptNumber,
        );

        // Persist attempt
        const attempt = this.attemptRepository.create({
            webhookId,
            eventType,
            payload,
            statusCode: result.statusCode,
            responseBody: result.responseBody?.substring(0, 1000),
            success: result.success,
            attemptNumber,
            durationMs: result.durationMs,
            error: result.error,
        });

        await this.attemptRepository.save(attempt);

        if (!result.success) {
            throw new Error(
                `Delivery failed with status ${result.statusCode}: ${result.error}`,
            );
        }
    }
}
