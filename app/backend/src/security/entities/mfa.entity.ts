import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MfaMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  BACKUP_CODE = 'backup_code',
  HARDWARE_TOKEN = 'hardware_token',
}

export enum MfaStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled',
  FAILED = 'failed',
}

@Entity('mfa_settings')
export class MfaSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: MfaMethod,
  })
  method: MfaMethod;

  @Column({
    type: 'enum',
    enum: MfaStatus,
    default: MfaStatus.PENDING,
  })
  status: MfaStatus;

  @Column({ type: 'varchar', nullable: true })
  secret: string; // For TOTP

  @Column({ type: 'varchar', nullable: true })
  phoneNumber: string; // For SMS

  @Column({ type: 'varchar', nullable: true })
  email: string; // For backup email

  @Column({ type: 'simple-array', nullable: true })
  backupCodes: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    issuer?: string;
    label?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
    lastUsed?: Date;
    attempts?: number;
    lockedUntil?: Date;
  };

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'boolean', default: false })
  isBackup: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}

@Entity('mfa_sessions')
export class MfaSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', unique: true })
  @Index()
  sessionId: string;

  @Column({ type: 'varchar' })
  challengeToken: string;

  @Column({
    type: 'enum',
    enum: MfaMethod,
  })
  method: MfaMethod;

  @Column({ type: 'jsonb' })
  challengeData: {
    attempts?: number;
    maxAttempts?: number;
    expiresAt?: Date;
    ipAddress?: string;
    userAgent?: string;
  };

  @Column({
    type: 'enum',
    enum: MfaStatus,
    default: MfaStatus.PENDING,
  })
  status: MfaStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;
}
