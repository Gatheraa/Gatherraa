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
import { Payment } from './payment.entity';

export enum RefundStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum RefundType {
  FULL = 'full',
  PARTIAL = 'partial',
}

@Entity('payment_refunds')
@Index(['paymentId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['stripeRefundId'], { unique: true, where: 'stripeRefundId IS NOT NULL' })
@Index(['idempotencyKey'], { unique: true })
export class PaymentRefund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  paymentId: string;

  @ManyToOne(() => Payment, (payment) => payment.refunds, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column({
    type: 'enum',
    enum: RefundType,
  })
  type: RefundType;

  @Column({
    type: 'enum',
    enum: RefundStatus,
    default: RefundStatus.PENDING,
  })
  status: RefundStatus;

  // Amount to refund (in smallest unit)
  @Column('decimal', { precision: 19, scale: 8 })
  amount: number;

  // Reason for refund
  @Column('text', { nullable: true })
  reason?: string;

  // Admin notes
  @Column('text', { nullable: true })
  notes?: string;

  // Stripe refund ID
  @Column({ nullable: true, unique: true })
  stripeRefundId?: string;

  // Crypto refund fields
  @Column({ nullable: true })
  refundTransactionHash?: string;

  @Column({ nullable: true })
  refundFromAddress?: string;

  @Column({ nullable: true })
  refundToAddress?: string;

  // Idempotency key
  @Column({ nullable: true, unique: true })
  idempotencyKey?: string;

  // Error tracking
  @Column({ nullable: true })
  errorCode?: string;

  @Column({ nullable: true })
  errorMessage?: string;

  // Retry information
  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt?: Date;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  // Webhook tracking
  @Column({ default: false })
  webhookProcessed: boolean;

  @Column({ nullable: true })
  webhookProcessedAt?: Date;

  // System fields
  @Column('uuid', { nullable: true })
  requestedBy?: string; // User or admin who requested refund

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
