import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { EmailTemplateVariant } from './email-template-variant.entity';

@Entity('email_logs')
@Index(['recipient', 'status'])
@Index(['templateId', 'status'])
@Index(['createdAt'])
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  recipient: string;

  @Column()
  subject: string;

  @Column()
  templateId: string;

  @Column({ nullable: true })
  templateVariantId: string;

  @Column({ nullable: true })
  variant: string; // Variant code (A, B, C, etc.)

  @Column({ default: 'PENDING' })
  status: string; // PENDING, SENT, DELIVERED, BOUNCED, COMPLAINED, OPENED, CLICKED, FAILED

  @Column({ nullable: true })
  providerMessageId: string;

  @Column({ default: 'UNKNOWN' })
  provider: string; // SENDGRID, AWS_SES, NODEMAILER

  @Column({ nullable: true })
  bounceType: string; // PERMANENT, TEMPORARY, TRANSIENT

  @Column({ nullable: true })
  bounceReason: string;

  @Column({ nullable: true })
  complaintType: string; // ABUSE, FRAUD, PERMANENT, TRANSIENT

  @Column({ nullable: true })
  complaintReason: string;

  @Column({ nullable: true })
  deliveryStatus: string;

  @Column({ nullable: true })
  deliveryReason: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  headers: Record<string, string>;

  @Column({ type: 'json', nullable: true })
  deviceInfo: Record<string, any>; // For tracking opens/clicks

  @Column({ nullable: true })
  openedAt: Date;

  @Column({ nullable: true })
  clickedAt: Date;

  @Column({ default: 0 })
  openCount: number;

  @Column({ default: 0 })
  clickCount: number;

  @Column({ nullable: true })
  unsubscribedAt: Date;

  @Column({ default: false })
  hasAttachments: boolean;

  @Column({ nullable: true })
  attachmentDetails: string;

  @ManyToOne(() => EmailTemplateVariant)
  templateVariant: EmailTemplateVariant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
