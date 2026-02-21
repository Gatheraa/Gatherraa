import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

export enum DeliveryChannel {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms',
}

export enum DeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

@Entity('notification_delivery')
@Index(['notificationId', 'channel'])
@Index(['notificationId', 'status'])
@Index(['userId', 'createdAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  notificationId: string;

  @ManyToOne(() => Notification, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationId' })
  notification: Notification;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: DeliveryChannel,
  })
  channel: DeliveryChannel;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.QUEUED,
  })
  status: DeliveryStatus;

  // Recipient information (varies by channel)
  @Column({ nullable: true })
  recipientAddress?: string; // email, phone number, etc.

  @Column({ nullable: true })
  deviceToken?: string;

  // Delivery tracking
  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  deliveredAt?: Date;

  @Column({ nullable: true })
  openedAt?: Date;

  @Column({ nullable: true })
  clickedAt?: Date;

  @Column({ nullable: true })
  bounceReason?: string;

  // External provider tracking
  @Column({ nullable: true })
  providerMessageId?: string;

  @Column({ nullable: true })
  providerStatus?: string;

  // Retry information
  @Column({ default: 0 })
  attemptCount: number;

  @Column({ nullable: true })
  lastAttemptAt?: Date;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  // Error tracking
  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  errorCode?: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    timestamp?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
