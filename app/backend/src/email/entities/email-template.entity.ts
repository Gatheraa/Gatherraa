import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { EmailTemplateVariant } from './email-template-variant.entity';
import { EmailAnalytics } from './email-analytics.entity';

@Entity('email_templates')
@Index(['name', 'language'])
@Index(['status'])
export class EmailTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: 'en' })
  language: string;

  @Column()
  subject: string;

  @Column('longtext')
  htmlContent: string;

  @Column('longtext', { nullable: true })
  textContent: string;

  @Column('longtext', { nullable: true })
  mjmlTemplate: string;

  @Column({ default: 'TRANSACTIONAL' })
  type: 'TRANSACTIONAL' | 'MARKETING';

  @Column({ default: 'DRAFT' })
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  @Column({ nullable: true })
  description: string;

  @Column('simple-array', { nullable: true })
  requiredVariables: string[];

  @Column({ default: 1 })
  version: number;

  @Column({ nullable: true })
  fromEmail: string;

  @Column({ nullable: true })
  fromName: string;

  @Column('simple-array', { nullable: true })
  replyToEmails: string[];

  @Column('simple-array', { nullable: true })
  ccEmails: string[];

  @Column('simple-array', { nullable: true })
  bccEmails: string[];

  @Column({ nullable: true })
  tags: string;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  clickCount: number;

  @OneToMany(
    () => EmailTemplateVariant,
    (variant) => variant.template,
  )
  variants: EmailTemplateVariant[];

  @OneToMany(
    () => EmailAnalytics,
    (analytics) => analytics.template,
  )
  analytics: EmailAnalytics[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
