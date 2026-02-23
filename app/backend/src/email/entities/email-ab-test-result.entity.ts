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

@Entity('email_ab_test_results')
@Index(['variantId', 'testName'])
@Index(['testStatus'])
export class EmailABTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  variantId: string;

  @Column({ unique: true })
  testName: string;

  @Column()
  testDescription: string;

  @Column({ default: 'ACTIVE' })
  testStatus: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

  @Column()
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  @Column({ default: 0 })
  totalSent: number;

  @Column({ default: 0 })
  totalOpened: number;

  @Column({ default: 0 })
  totalClicked: number;

  @Column({ default: 0 })
  totalConverted: number;

  @Column({ nullable: true })
  openRate: number;

  @Column({ nullable: true })
  clickRate: number;

  @Column({ nullable: true })
  conversionRate: number;

  @Column({ nullable: true })
  revenue: number;

  @Column({ nullable: true })
  revenuePerEmail: number;

  @Column({ nullable: true })
  winner: string; // Winning variant ID

  @Column({ nullable: true })
  confidence: number; // Statistical confidence (0-100)

  @ManyToOne(() => EmailTemplateVariant, (variant) => variant.abTestResults)
  variant: EmailTemplateVariant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
