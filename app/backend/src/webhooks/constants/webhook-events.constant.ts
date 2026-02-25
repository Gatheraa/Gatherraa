/**
 * WEBHOOK_EVENTS — The complete catalogue of event types that can be
 * subscribed to via webhooks.
 */
export const WEBHOOK_EVENTS = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    EVENT_CREATED: 'event.created',
    EVENT_UPDATED: 'event.updated',
    EVENT_DELETED: 'event.deleted',
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
    REFUND_CREATED: 'refund.created',
    COUPON_CREATED: 'coupon.created',
    COUPON_APPLIED: 'coupon.applied',
} as const;

export type WebhookEventType =
    (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventType[] =
    Object.values(WEBHOOK_EVENTS);
