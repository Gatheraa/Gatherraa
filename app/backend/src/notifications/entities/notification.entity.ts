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
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
  IN_APP = 'in_app',
  SMS = 'sms',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
}

export enum NotificationCategory {
  EVENT_REMINDER = 'event_reminder',
  TICKET_SALE = 'ticket_sale',
  REVIEW = 'review',
  SYSTEM_ALERT = 'system_alert',
  MARKETING = 'marketing',
  INVITATION = 'invitation',
  COMMENT = 'comment',
  FOLLOWER = 'follower',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'status'])
@Index(['userId', 'read'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
  })
  category: NotificationCategory;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ nullable: true })
  templateId?: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    eventId?: string;
    ticketId?: string;
    reviewId?: string;
    userId?: string;
    actionUrl?: string;
  };

  @Column({ default: false })
  read: boolean;

  @Column({ nullable: true })
  readAt?: Date;

  @Column({ nullable: true })
  scheduledFor?: Date;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetriedAt?: Date;

  @Column({ nullable: true })
  failureReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
