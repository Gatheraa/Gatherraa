import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsDate, IsBoolean, IsEnum, IsOptional } from 'class-validator';

export enum ApiTier {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  CUSTOM = 'CUSTOM'
}

export enum QuotaPeriod {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

@Entity('api_quotas')
export class ApiQuota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  apiKeyId?: string;

  @Column({ type: 'enum', enum: ApiTier })
  @Index()
  tier: ApiTier;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  endpoint: string; // API endpoint or resource

  @Column({ type: 'enum', enum: QuotaPeriod })
  period: QuotaPeriod;

  @Column({ type: 'int' })
  limit: number;

  @Column({ type: 'int', default: 0 })
  used: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  overage: number; // Overage usage beyond limit

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0.01 })
  overageRate: number; // Cost per unit overage

  @Column({ type: 'datetime' })
  @Index()
  periodStart: Date;

  @Column({ type: 'datetime' })
  @Index()
  periodEnd: Date;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
