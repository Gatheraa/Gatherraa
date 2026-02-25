import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDeliveryAttempt } from './entities/webhook-delivery-attempt.entity';
import { WebhookDeliveryProducer } from './queues/webhook-delivery.producer';
import { WebhookDeliveryProcessor } from './queues/webhook-delivery.processor';
import { WebhookEventListener } from './listeners/webhook-event.listener';

/**
 * WEBHOOK IMPLEMENTATION DECISION:
 * This module implements a custom HMAC-based webhook system.
 * Decision rationale: Full control required over delivery retry logic and analytics.
 * BullMQ (Redis) is already used in the project, making it the natural choice for retry management.
 * No managed webhook provider (like Svix) was found in existing dependencies.
 *
 * Selected: Custom because it leverages existing infrastructure (Redis + BullMQ) without external costs.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([WebhookSubscription, WebhookDeliveryAttempt]),
        BullModule.registerQueue({
            name: 'webhook-delivery',
            defaultJobOptions: {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 60000,
                },
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        }),
        HttpModule,
    ],
    controllers: [WebhooksController],
    providers: [
        WebhooksService,
        WebhookDeliveryProducer,
        WebhookDeliveryProcessor,
        WebhookEventListener,
    ],
    exports: [WebhooksService],
})
export class WebhooksModule { }
