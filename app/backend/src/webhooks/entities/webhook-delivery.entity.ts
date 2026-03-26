import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Webhook } from './webhook.entity';
import { WebhookDeliveryStatus, WebhookEventType } from '../constants/webhook.constants';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  @Index()
  webhook: Webhook;

  @Column({ type: 'uuid' })
  webhookId: string;

  @Column({ type: 'enum', enum: WebhookEventType })
  eventType: WebhookEventType;

  @Index()
  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'enum', enum: WebhookDeliveryStatus })
  status: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  statusCode: number;

  @Column({ type: 'text', nullable: true })
  responseBody: string;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'jsonb', nullable: true })
  headers: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastAttemptAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;
}
