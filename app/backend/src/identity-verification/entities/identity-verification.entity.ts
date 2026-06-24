import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { VerificationHistory } from './verification-history.entity';

export enum VerificationStep {
  EMAIL = 'email',
  PHONE = 'phone',
  GOVERNMENT_ID = 'government_id',
  FACE_MATCH = 'face_match',
  WALLET = 'wallet',
  ADDRESS = 'address',
}

export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('identity_verifications')
export class IdentityVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: VerificationStep,
  })
  step: VerificationStep;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ type: 'boolean', default: true })
  isRequired: boolean;

  @OneToMany(() => VerificationHistory, (history) => history.verification, {
    cascade: true,
  })
  history: VerificationHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;
}
