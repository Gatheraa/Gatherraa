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
import { AnalyticsType } from '../enums/analytics-type.enum';

@Entity('gamification_analytics')
export class GamificationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: AnalyticsType,
    default: AnalyticsType.USER_ENGAGEMENT,
  })
  @Index()
  type: AnalyticsType;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  eventType: string;

  @Column({ type: 'jsonb' })
  eventData: {
    action: string;
    category: string;
    value?: number;
    metadata?: Record<string, any>;
  };

  @Column({ type: 'jsonb' })
  context: {
    timestamp: Date;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    platform?: string;
    version?: string;
  };

  @Column({ type: 'jsonb' })
  metrics: {
    engagementScore: number;
    retentionRisk: number;
    churnProbability: number;
    lifetimeValue: number;
    acquisitionCost: number;
    satisfactionScore: number;
  };

  @Column({ type: 'jsonb' })
  gamificationImpact: {
    pointsEarned: number;
    achievementsUnlocked: number;
    streaksMaintained: number;
    challengesCompleted: number;
    guildContributions: number;
    socialInteractions: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  behavioralPatterns: {
    preferredActivities: string[];
    peakActivityTimes: number[];
    learningStyle: string;
    motivationType: string;
    riskFactors: string[];
    strengths: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  predictions: {
    nextWeekActivity: number;
    likelyChallenges: string[];
    optimalDifficulty: number;
    recommendedContent: string[];
    interventionNeeded: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  cohort: {
    joinDate: Date;
    cohortGroup: string;
    cohortMetrics: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  segmentation: {
    userSegment: string;
    behaviorSegment: string;
    valueSegment: string;
    engagementSegment: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  processedAt: Date;

  @Column({ type: 'boolean', default: false })
  isProcessed: boolean;
}

@Entity('engagement_metrics')
export class EngagementMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'date' })
  @Index()
  date: Date;

  @Column({ type: 'jsonb' })
  dailyMetrics: {
    loginCount: number;
    sessionDuration: number;
    activitiesCompleted: number;
    pointsEarned: number;
    tokensEarned: number;
    socialInteractions: number;
    challengesAttempted: number;
    achievementsUnlocked: number;
  };

  @Column({ type: 'jsonb' })
  weeklyMetrics: {
    activeDays: number;
    totalPoints: number;
    averageSessionDuration: number;
    retentionRate: number;
    engagementScore: number;
  };

  @Column({ type: 'jsonb' })
  monthlyMetrics: {
    totalActivities: number;
    skillProgress: Record<string, number>;
    communityContributions: number;
    mentorshipHours: number;
    collaborationScore: number;
  };

  @Column({ type: 'float', default: 0 })
  engagementScore: number;

  @Column({ type: 'float', default: 0 })
  retentionScore: number;

  @Column({ type: 'float', default: 0 })
  growthScore: number;

  @Column({ type: 'float', default: 0 })
  socialScore: number;

  @Column({ type: 'float', default: 0 })
  learningScore: number;

  @Column({ type: 'jsonb', nullable: true })
  trends: {
    dailyTrend: number[];
    weeklyTrend: number[];
    monthlyTrend: number[];
    seasonality: Record<string, number>;
  };

  @Column({ type: 'jsonb', nullable: true })
  predictions: {
    nextWeekEngagement: number;
    churnRisk: number;
    optimalIntervention: string;
    recommendedActions: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('gamification_insurance')
export class GamificationInsurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  policyType: string;

  @Column({ type: 'jsonb' })
  coverage: {
    streakProtection: boolean;
    achievementGuarantee: boolean;
    rewardInsurance: boolean;
    challengeAssistance: boolean;
  };

  @Column({ type: 'jsonb' })
  terms: {
    premium: number;
    deductible: number;
    coverageLimit: number;
    waitingPeriod: number;
    claimLimit: number;
  };

  @Column({ type: 'datetime' })
  startsAt: Date;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  claims: {
    id: string;
    type: string;
    amount: number;
    status: string;
    filedAt: Date;
    resolvedAt?: Date;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
