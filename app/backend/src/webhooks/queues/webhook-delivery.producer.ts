import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhookEventType } from '../constants/webhook-events.constant';

@Injectable()
export class WebhookDeliveryProducer {
    constructor(
        @InjectQueue('webhook-delivery')
        private readonly webhookDeliveryQueue: Queue,
    ) { }

    async enqueueDelivery(
        webhookId: string,
        eventType: WebhookEventType,
        payload: Record<string, any>,
    ): Promise<void> {
        await this.webhookDeliveryQueue.add(
            'deliver',
            { webhookId, eventType, payload },
            {
                jobId: `${webhookId}-${eventType}-${Date.now()}`,
                removeOnComplete: 100,
                removeOnFail: 500,
            },
        );
    }
}
