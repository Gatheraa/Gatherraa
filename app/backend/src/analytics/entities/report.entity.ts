import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsNumber, IsString, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'json' })
  filters: Record<string, any>;

  @Column({ type: 'json' })
  columns: string[];

  @Column({ type: 'varchar', length: 50 })
  format: string; // csv, excel, pdf

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column({ nullable: true })
  @Index()
  eventId?: string;

  @Column({ default: false })
  isScheduled: boolean;

  @Column({ type: 'json', nullable: true })
  scheduleConfig?: Record<string, any>; // cron expression, recipients, etc.

  @Column({ nullable: true })
  lastRunAt?: Date;

  @Column({ nullable: true })
  nextRunAt?: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  @Index()
  status?: string; // pending, processing, completed, failed

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  filePath?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}