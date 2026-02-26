import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum LmsProvider {
  CANVAS = 'CANVAS',
  MOODLE = 'MOODLE',
  BLACKBOARD = 'BLACKBOARD',
  D2L = 'D2L',
  GOOGLE_CLASSROOM = 'GOOGLE_CLASSROOM',
  SAKAI = 'SAKAI',
}

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
  AUTHENTICATING = 'AUTHENTICATING',
}

@Entity('lms_connections')
export class LmsConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: LmsProvider,
  })
  provider: LmsProvider;

  @Column()
  baseUrl: string;

  @Column({ nullable: true })
  apiKey: string;

  @Column({ nullable: true })
  apiSecret: string;

  @Column({ nullable: true })
  accessToken: string;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  tokenExpiresAt: Date;

  @Column({
    type: 'enum',
    enum: ConnectionStatus,
    default: ConnectionStatus.PENDING,
  })
  status: ConnectionStatus;

  @Column('json', { nullable: true })
  configuration: Record<string, any>;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ nullable: true })
  nextSyncAt: Date;

  @Column({ default: 30 })
  syncInterval: number; // in minutes

  @Column({ default: true })
  autoSync: boolean;

  @Column({ default: 0 })
  syncFailureCount: number;

  @Column({ nullable: true })
  lastError: string;

  @Column({ nullable: true })
  adminUserId: string;

  @Column({ nullable: true })
  accountId: string;

  @Column({ default: false })
  isTestConnection: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
