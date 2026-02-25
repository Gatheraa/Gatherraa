import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { EventType } from '../enums/event-type.enum';
import { EventStatus } from '../enums/event-status.enum';

@Entity('seasonal_events')
export class SeasonalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  theme: string;

  @Column({
    type: 'enum',
    enum: EventType,
    default: EventType.SPECIAL,
  })
  @Index()
  type: EventType;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  @Index()
  status: EventStatus;

  @Column({ type: 'datetime' })
  startsAt: Date;

  @Column({ type: 'datetime' })
  endsAt: Date;

  @Column({ type: 'jsonb' })
  rewards: {
    participation: {
      points: number;
      tokens: number;
      badge?: string;
    };
    completion: {
      points: number;
      tokens: number;
      badge?: string;
      title?: string;
    };
    leaderboard: Array<{
      rank: number;
      rewards: any[];
    }>;
  };

  @Column({ type: 'jsonb' })
  challenges: {
    id: string;
    name: string;
    description: string;
    difficulty: string;
    points: number;
    tokens: number;
    maxCompletions?: number;
  }[];

  @Column({ type: 'jsonb' })
  specialActivities: {
    id: string;
    name: string;
    type: string;
    schedule: {
      frequency: string;
      times: string[];
    };
    rewards: any[];
  }[];

  @Column({ type: 'jsonb' })
  milestones: {
    target: number;
    reward: any;
    description: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  leaderboard: {
    type: string;
    algorithm: string;
    resetSchedule: string;
    maxEntries: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  personalization: {
    userSegmentation: string[];
    adaptiveDifficulty: boolean;
    personalizedChallenges: boolean;
  };

  @Column({ type: 'jsonb' })
  statistics: {
    participants: number;
    completions: number;
    averageCompletionTime: number;
    engagementRate: number;
    satisfaction: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  requirements: {
    minLevel?: number;
    prerequisiteEvents?: string[];
    requiredSkills?: string[];
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'jsonb', nullable: true })
  recurrence: {
    frequency: 'monthly' | 'quarterly' | 'yearly';
    month?: number;
    day?: number;
    duration: number; // in days
  };

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @OneToMany(() => UserEventParticipation, participation => participation.event)
  participations: UserEventParticipation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('user_event_participations')
export class UserEventParticipation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SeasonalEvent, { nullable: false })
  @JoinColumn({ name: 'eventId' })
  event: SeasonalEvent;

  @Column({ type: 'uuid' })
  @Index()
  eventId: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'datetime' })
  joinedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'jsonb' })
  progress: {
    currentStep: number;
    completedChallenges: string[];
    earnedPoints: number;
    earnedTokens: number;
    percentage: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  challengeProgress: {
    [challengeId: string]: {
      current: number;
      target: number;
      completed: boolean;
      completedAt?: Date;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    claimed: boolean;
    claimedAt?: Date;
    items: any[];
  };

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;
}
