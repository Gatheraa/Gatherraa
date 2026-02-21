import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_analytics')
@Index(['date', 'category'])
@Index(['date', 'channel'])
@Index(['userId', 'date'])
export class NotificationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date')
  date: Date;

  @Column('uuid', { nullable: true })
  userId?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  channel?: string;

  // Metrics
  @Column({ default: 0 })
  totalSent: number;

  @Column({ default: 0 })
  totalDelivered: number;

  @Column({ default: 0 })
  totalOpened: number;

  @Column({ default: 0 })
  totalClicked: number;

  @Column({ default: 0 })
  totalFailed: number;

  @Column({ default: 0 })
  totalBounced: number;

  // Rates (percentages)
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  deliveryRate: number; // percentage

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  openRate: number; // percentage

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  clickRate: number; // percentage

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  failureRate: number; // percentage

  // Engagement metrics
  @Column({ default: 0 })
  averageTimeToOpen: number; // in seconds

  @Column({ default: 0 })
  averageTimeToClick: number; // in seconds

  // Additional metrics
  @Column({ default: 0 })
  uniqueOpens: number;

  @Column({ default: 0 })
  uniqueClicks: number;

  @Column({ nullable: true })
  tags?: string;

  @Column({ type: 'jsonb', nullable: true })
  additionalMetrics?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
