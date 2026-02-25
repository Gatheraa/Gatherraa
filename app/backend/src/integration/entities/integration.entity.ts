import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { IntegrationLog } from './integration-log.entity';
import { DataMappingRule } from './data-mapping-rule.entity';
import { IntegrationMetrics } from './integration-metrics.entity';

export enum IntegrationType {
  LMS = 'LMS',
  CRM = 'CRM',
  PAYMENT = 'PAYMENT',
  NOTIFICATION = 'NOTIFICATION',
  ANALYTICS = 'ANALYTICS',
  CUSTOM = 'CUSTOM',
}

export enum IntegrationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  PENDING = 'PENDING',
}

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({
    type: 'enum',
    enum: IntegrationType,
  })
  type: IntegrationType;

  @Column({
    type: 'enum',
    enum: IntegrationStatus,
    default: IntegrationStatus.PENDING,
  })
  status: IntegrationStatus;

  @Column({ nullable: true })
  version: string;

  @Column('json', { nullable: true })
  configuration: Record<string, any>;

  @Column('json', { nullable: true })
  credentials: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastSyncAt: Date;

  @Column({ nullable: true })
  nextSyncAt: Date;

  @Column({ default: 0 })
  syncInterval: number; // in minutes

  @Column('json', { nullable: true })
  webhookEndpoints: string[];

  @Column({ default: 0 })
  rateLimitPerMinute: number;

  @Column({ default: 0 })
  maxRetries: number;

  @Column({ default: 0 })
  currentRetryCount: number;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => IntegrationLog, (log) => log.integration)
  logs: IntegrationLog[];

  @OneToMany(() => DataMappingRule, (rule) => rule.integration)
  dataMappingRules: DataMappingRule[];

  @OneToMany(() => IntegrationMetrics, (metrics) => metrics.integration)
  metrics: IntegrationMetrics[];
}
