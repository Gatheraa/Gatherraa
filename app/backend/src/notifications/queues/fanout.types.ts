export const NOTIFICATION_FANOUT_QUEUE = 'notification-fanout';
export const FANOUT_BATCH_SIZE = 100;

export interface FanoutJobData {
  topicKey: string;
  category: string;
  title: string;
  message: string;
  type: string;
  templateId?: string;
  data?: Record<string, unknown>;
  recipientIds: string[];
  scheduledFor?: string;
}
