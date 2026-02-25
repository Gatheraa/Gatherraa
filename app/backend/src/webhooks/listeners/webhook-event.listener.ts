import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter'; // For traditional events if any
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { EventCreatedEvent } from '../../events/events/event-created.event';
import { WebhooksService } from '../webhooks.service';
import { WebhookDeliveryProducer } from '../queues/webhook-delivery.producer';
import { WebhookPayloadBuilder } from '../versioning/webhook-payload.builder';
import { ALL_WEBHOOK_EVENT_TYPES, WEBHOOK_EVENTS } from '../constants/webhook-events.constant';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';

@Injectable()
@EventsHandler(EventCreatedEvent)
export class WebhookEventListener implements IEventHandler<any> {
    private readonly logger = new Logger(WebhookEventListener.name);

    constructor(
        @InjectRepository(WebhookSubscription)
        private readonly webhookRepository: Repository<WebhookSubscription>,
        private readonly deliveryProducer: WebhookDeliveryProducer,
    ) { }

    async handle(event: any) {
        let eventType: string;

        // Map domain events to webhook event types
        if (event instanceof EventCreatedEvent) {
            eventType = WEBHOOK_EVENTS.EVENT_CREATED;
        } else {
            // Handle other domain events if added later
            return;
        }

        this.logger.log(`Handling domain event for webhooks: ${eventType}`);

        // Find active webhooks subscribed to this event
        // Note: 'events' is stored as simple-json (array string in SQLite)
        const activeWebhooks = await this.webhookRepository.find({
            where: { isActive: true },
        });

        const subscribedWebhooks = activeWebhooks.filter(w =>
            w.events.includes(eventType) || w.events.includes('*')
        );

        if (subscribedWebhooks.length === 0) {
            this.logger.debug(`No active webhooks subscribed to ${eventType}`);
            return;
        }

        for (const webhook of subscribedWebhooks) {
            const payload = WebhookPayloadBuilder.build(
                webhook.version,
                eventType as any,
                event,
            );

            await this.deliveryProducer.enqueueDelivery(
                webhook.id,
                eventType as any,
                payload,
            );
        }
    }

    // Support for traditional NestJS events if used
    @OnEvent('**')
    async handleEverything(payload: any, event: string) {
        // Only handle events defined in our catalogue
        if (!ALL_WEBHOOK_EVENT_TYPES.includes(event as any)) return;

        // Implementation logic similar to above...
    }
}
