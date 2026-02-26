import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('api_usage_logs')
export class ApiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  apiKeyId?: string;

  @Column({ type: 'varchar', length: 45 })
  @Index()
  ipAddress: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  endpoint: string;

  @Column({ type: 'varchar', length: 10 })
  @Index()
  method: string;

  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'int', default: 0 })
  responseTime: number; // Response time in milliseconds

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  cost: number; // Request cost (for billing)

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  userAgent?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  referer?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index()
  apiVersion?: string;

  @Column({ type: 'json', nullable: true })
  requestHeaders?: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  responseHeaders?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  rateLimitTier?: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isRateLimited: boolean;

  @Column({ type: 'boolean', default: false })
  @Index()
  isBlocked: boolean;

  @Column({ type: 'datetime' })
  @Index()
  timestamp: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
