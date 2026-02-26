import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { StreakType } from '../enums/streak-type.enum';

@Entity('streaks')
export class Streak {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: StreakType,
    default: StreakType.DAILY_LOGIN,
  })
  @Index()
  type: StreakType;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'int', default: 0 })
  @Index()
  currentStreak: number;

  @Column({ type: 'int', default: 0 })
  longestStreak: number;

  @Column({ type: 'date' })
  @Index()
  lastActivityDate: Date;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'jsonb' })
  criteria: {
    action: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    requiredCount: number;
    timeWindow?: number; // in hours
    gracePeriod?: number; // in hours
  };

  @Column({ type: 'jsonb' })
  schedule: {
    timezone: string;
    resetTime: string; // HH:MM format
    activeDays: number[]; // 0-6 (Sunday-Saturday)
    exceptions: {
      date: Date;
      isSkipped: boolean;
      reason?: string;
    }[];
  };

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    milestone: number;
    type: 'points' | 'tokens' | 'badge' | 'title' | 'privilege';
    value: any;
    description?: string;
  }[];

  @Column({ type: 'jsonb' })
  statistics: {
    totalDays: number;
    completionRate: number;
    averageGap: number; // in days
    monthlyCompletions: number[];
    yearlyCompletions: number[];
    bestMonth: {
      month: number;
      year: number;
      completions: number;
    };
    bestYear: {
      year: number;
      completions: number;
    };
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isProtected: boolean; // Protected streaks don't break on missed days

  @Column({ type: 'int', nullable: true })
  protectionUses: number;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;
}

@Entity('streak_activities')
export class StreakActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Streak, { nullable: false })
  @JoinColumn({ name: 'streakId' })
  streak: Streak;

  @Column({ type: 'uuid' })
  @Index()
  streakId: string;

  @Column({ type: 'date' })
  @Index()
  activityDate: Date;

  @Column({ type: 'datetime' })
  activityTime: Date;

  @Column({ type: 'jsonb' })
  activity: {
    type: string;
    description: string;
    value?: number;
    metadata?: Record<string, any>;
  };

  @Column({ type: 'boolean', default: true })
  isCompleted: boolean;

  @Column({ type: 'boolean', default: false })
  isBonus: boolean;

  @Column({ type: 'int', default: 1 })
  count: number;

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    points: number;
    tokens: number;
    bonuses: any[];
  };

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
