import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsString, IsNumber, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('blocked_ips')
export class BlockedIp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 45 })
  @Index()
  ipAddress: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  blockType: 'MANUAL' | 'AUTOMATIC' | 'DDOS' | 'ABUSE' | 'RATE_LIMIT';

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>; // Additional context like request patterns

  @Column({ type: 'int', default: 0 })
  violationCount: number;

  @Column({ type: 'datetime' })
  @Index()
  blockedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  @Index()
  expiresAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  blockedBy?: string; // Admin or system that blocked the IP

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true })
  unblockedAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unblockedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
