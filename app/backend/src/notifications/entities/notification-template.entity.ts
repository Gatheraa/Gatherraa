import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_templates')
@Index(['code'], { unique: true })
@Index(['enabled'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ['event_reminder', 'ticket_sale', 'review', 'system_alert', 'marketing', 'invitation', 'comment', 'follower'],
  })
  category: string;

  // Template content
  @Column()
  emailSubject: string;

  @Column('text')
  emailTemplate: string;

  @Column()
  pushTitle: string;

  @Column('text')
  pushMessage: string;

  @Column('text')
  inAppTitle: string;

  @Column('text')
  inAppMessage: string;

  // SMS template (if applicable)
  @Column('text', { nullable: true })
  smsTemplate?: string;

  // Variables/placeholders example
  @Column({ type: 'simple-array', default: '' })
  variables: string[];

  // Default data for the template
  @Column({ type: 'jsonb', nullable: true })
  defaultData?: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  createdBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
