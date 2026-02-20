import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsNumber, IsString, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('event_analytics')
export class EventAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  eventId?: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'json', nullable: true })
  metrics: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  eventData: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  userProperties?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  @Index()
  timestamp?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  eventType?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  @Index()
  source?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  sessionId?: string;

  @Column({ default: false })
  @Index()
  isProcessed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}