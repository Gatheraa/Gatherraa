import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { IsNumber, IsString, IsDate, IsBoolean, IsOptional } from 'class-validator';

@Entity('user_behavior_analytics')
export class UserBehaviorAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  behaviorType: string; // page_view, click, scroll, purchase, share, comment, like, etc.

  @Column({ type: 'json', nullable: true })
  behaviorData: Record<string, any>; // Specific data about the behavior

  @Column({ type: 'json', nullable: true })
  context: Record<string, any>; // Context like page, device, location, etc.

  @Column({ type: 'varchar', length: 200, nullable: true })
  @Index()
  targetEntity?: string; // Event ID, product ID, etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  entityType?: string; // event, product, user, etc.

  @Column({ type: 'simple-json', nullable: true })
  userProperties?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  sessionId?: string;

  @Column({ type: 'datetime' })
  @Index()
  timestamp: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  @Index()
  source?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  device?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  location?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  value?: number; // Monetary value for purchase behaviors

  @Column({ type: 'int', nullable: true })
  duration?: number; // Duration in seconds for time-based behaviors

  @Column({ default: false })
  @Index()
  isConverted: boolean; // Whether this behavior led to conversion

  @Column({ type: 'json', nullable: true })
  attribution?: Record<string, any>; // Attribution data

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
