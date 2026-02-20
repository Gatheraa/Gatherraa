import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsNumber, IsString, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('analytics_summaries')
export class AnalyticsSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  metricType: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  period: string; // daily, weekly, monthly, yearly

  @Column({ type: 'date' })
  @Index()
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @Column({ type: 'json' })
  summaryData: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  entityId?: string; // event id, user id, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType?: string; // event, user, organizer, etc.

  @Column({ default: false })
  @Index()
  isAnomalyDetected: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}