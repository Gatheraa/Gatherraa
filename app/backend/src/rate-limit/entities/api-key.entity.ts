import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  key: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'] })
  @Index()
  tier: string;

  @Column({ type: 'json' })
  permissions: string[]; // Array of allowed endpoints/resources

  @Column({ type: 'json', nullable: true })
  rateLimits?: Record<string, any>; // Custom rate limits per endpoint

  @Column({ type: 'int', default: 0 })
  totalRequests: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalCost: number;

  @Column({ type: 'datetime', nullable: true })
  lastUsedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ type: 'text', nullable: true })
  revokedReason?: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
