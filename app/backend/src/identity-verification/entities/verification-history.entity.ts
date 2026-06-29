import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {
  IdentityVerification,
  VerificationStep,
  VerificationStatus,
} from './identity-verification.entity';

export enum VerificationAction {
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RETRIED = 'retried',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('verification_history')
export class VerificationHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  verificationId: string;

  @ManyToOne(() => IdentityVerification, (verification) => verification.history)
  @JoinColumn({ name: 'verificationId' })
  verification: IdentityVerification;

  @Column({
    type: 'enum',
    enum: VerificationAction,
  })
  action: VerificationAction;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
