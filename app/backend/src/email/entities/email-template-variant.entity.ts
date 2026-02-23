import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailLog } from './email-log.entity';
import { EmailABTestResult } from './email-ab-test-result.entity';

@Entity('email_template_variants')
@Index(['templateId', 'variantName'])
export class EmailTemplateVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  templateId: string;

  @Column({ unique: true })
  variantName: string;

  @Column({ description: 'A, B, C, etc.' })
  variantCode: string;

  @Column('longtext')
  subject: string;

  @Column('longtext')
  htmlContent: string;

  @Column('longtext', { nullable: true })
  textContent: string;

  @Column('longtext', { nullable: true })
  mjmlTemplate: string;

  @Column({ default: 0 })
  weight: number; // Percentage (0-100) of traffic to send to this variant

  @Column({ type: 'simple-array', nullable: true })
  trackingPixels: string[];

  @Column({ type: 'simple-array', nullable: true })
  clicks: string[];

  @ManyToOne(() => EmailTemplate, (template) => template.variants)
  template: EmailTemplate;

  @OneToMany(() => EmailLog, (log) => log.templateVariant)
  logs: EmailLog[];

  @OneToMany(() => EmailABTestResult, (result) => result.variant)
  abTestResults: EmailABTestResult[];

  @CreateDateColumn()
  createdAt: Date;
}
