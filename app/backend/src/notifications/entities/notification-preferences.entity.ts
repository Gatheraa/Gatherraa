import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface ChannelPreferences {
  email?: boolean;
  push?: boolean;
  inApp?: boolean;
  sms?: boolean;
}

export interface NotificationCategoryPreferences {
  eventReminder?: ChannelPreferences;
  ticketSale?: ChannelPreferences;
  review?: ChannelPreferences;
  systemAlert?: ChannelPreferences;
  marketing?: ChannelPreferences;
  invitation?: ChannelPreferences;
  comment?: ChannelPreferences;
  follower?: ChannelPreferences;
}

@Entity('notification_preferences')
@Index(['userId'], { unique: true })
export class NotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  userId: string;

  @OneToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Global notification settings
  @Column({ default: true })
  notificationsEnabled: boolean;

  // Channel settings
  @Column({ type: 'jsonb', default: { email: true, push: true, inApp: true, sms: false } })
  defaultChannels: ChannelPreferences;

  // Category-based preferences
  @Column({
    type: 'jsonb',
    default: {
      eventReminder: { email: true, push: true, inApp: true, sms: false },
      ticketSale: { email: true, push: true, inApp: true, sms: false },
      review: { email: true, push: false, inApp: true, sms: false },
      systemAlert: { email: true, push: true, inApp: true, sms: true },
      marketing: { email: false, push: false, inApp: true, sms: false },
      invitation: { email: true, push: true, inApp: true, sms: false },
      comment: { email: false, push: true, inApp: true, sms: false },
      follower: { email: false, push: false, inApp: true, sms: false },
    },
  })
  categoryPreferences: NotificationCategoryPreferences;

  // Quiet hours
  @Column({ type: 'jsonb', nullable: true })
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    timezone?: string;
  };

  // Frequency settings
  @Column({ default: 'immediate' })
  frequency: 'immediate' | 'daily_digest' | 'weekly_digest';

  // Unsubscribe settings
  @Column({ default: false })
  unsubscribedFromAll: boolean;

  @Column({ type: 'simple-array', default: '' })
  unsubscribedCategories: string[];

  // Email preferences
  @Column({ nullable: true })
  primaryEmail?: string;

  @Column({ default: false })
  emailVerified: boolean;

  // Push notification device tokens
  @Column({ type: 'simple-array', default: '' })
  deviceTokens: string[];

  // Push notification settings
  @Column({ default: true })
  pushEnabled: boolean;

  @Column({ nullable: true })
  fcmToken?: string;

  // SMS preferences
  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ default: false })
  phoneVerified: boolean;

  // Language and locale
  @Column({ default: 'en-US' })
  language: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
