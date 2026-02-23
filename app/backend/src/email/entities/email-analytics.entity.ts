import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { EmailTemplate } from './email-template.entity';

@Entity('email_analytics')
@Index(['templateId', 'date'])
@Index(['templateId', 'status'])
export class EmailAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  templateId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 0 })
  sent: number;

  @Column({ default: 0 })
  delivered: number;

  @Column({ default: 0 })
  bounced: number;

  @Column({ default: 0 })
  complained: number;

  @Column({ default: 0 })
  opened: number;

  @Column({ default: 0 })
  clicked: number;

  @Column({ default: 0 })
  unsubscribed: number;

  @Column({ default: 0 })
  failed: number;

  @Column({ nullable: true })
  avgOpenRate: number;

  @Column({ nullable: true })
  avgClickRate: number;

  @Column({ nullable: true })
  avgBounceRate: number;

  @Column({ nullable: true })
  avgComplaintRate: number;

  @ManyToOne(() => EmailTemplate, (template) => template.analytics)
  template: EmailTemplate;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
