import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Integration } from './integration.entity';

export enum WebhookEventType {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  COURSE_ENROLLED = 'COURSE_ENROLLED',
  COURSE_COMPLETED = 'COURSE_COMPLETED',
  ASSIGNMENT_SUBMITTED = 'ASSIGNMENT_SUBMITTED',
  GRADE_POSTED = 'GRADE_POSTED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  CUSTOM = 'CUSTOM',
}

export enum WebhookStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Integration, (integration) => integration.id)
  integration: Integration;

  @Column()
  integrationId: string;

  @Column()
  eventType: WebhookEventType;

  @Column()
  eventSource: string;

  @Column('json')
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING,
  })
  status: WebhookStatus;

  @Column()
  endpointUrl: string;

  @Column({ nullable: true })
  secretKey: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ default: 3 })
  maxRetries: number;

  @Column({ nullable: true })
  lastRetryAt: Date;

  @Column({ nullable: true })
  nextRetryAt: Date;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  responseCode: number;

  @Column({ nullable: true })
  responseBody: string;

  @Column({ nullable: true })
  processingDuration: number; // in milliseconds

  @Column({ nullable: true })
  requestId: string;

  @Column({ default: false })
  isDelivered: boolean;

  @Column({ nullable: true })
  deliveredAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
