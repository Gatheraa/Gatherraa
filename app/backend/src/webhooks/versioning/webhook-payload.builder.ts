import { randomUUID } from 'crypto';
import { WebhookEventType } from '../constants/webhook-events.constant';

/**
 * WebhookPayloadBuilder — Constructs versioned webhook payloads.
 */
export class WebhookPayloadBuilder {
    static build(
        version: string,
        eventType: WebhookEventType,
        data: Record<string, any>,
    ) {
        switch (version) {
            case 'v1':
                return this.buildV1(eventType, data);
            case 'v2':
                return this.buildV2(eventType, data);
            default:
                return this.buildV1(eventType, data);
        }
    }

    private static buildV1(eventType: string, data: Record<string, any>) {
        return {
            specVersion: '1.0',
            id: randomUUID(),
            type: eventType,
            source: 'gatherraa',
            time: new Date().toISOString(),
            data,
        };
    }

    private static buildV2(eventType: string, data: Record<string, any>) {
        return {
            ...this.buildV1(eventType, data),
            specVersion: '2.0',
            // Future v2-specific fields can be added here
        };
    }
}
