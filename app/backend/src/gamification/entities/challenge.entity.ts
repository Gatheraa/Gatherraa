import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChallengeType } from '../enums/challenge-type.enum';
import { ChallengeDifficulty } from '../enums/challenge-difficulty.enum';
import { ChallengeStatus } from '../enums/challenge-status.enum';

@Entity('challenges')
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  imageUrl: string;

  @Column({
    type: 'enum',
    enum: ChallengeType,
    default: ChallengeType.INDIVIDUAL,
  })
  @Index()
  type: ChallengeType;

  @Column({
    type: 'enum',
    enum: ChallengeDifficulty,
    default: ChallengeDifficulty.MEDIUM,
  })
  @Index()
  difficulty: ChallengeDifficulty;

  @Column({
    type: 'enum',
    enum: ChallengeStatus,
    default: ChallengeStatus.DRAFT,
  })
  @Index()
  status: ChallengeStatus;

  @Column({ type: 'jsonb' })
  objectives: {
    id: string;
    description: string;
    type: string;
    target: number;
    points: number;
    order: number;
    isRequired: boolean;
  }[];

  @Column({ type: 'jsonb' })
  rewards: {
    points: number;
    tokens: number;
    badges?: string[];
    titles?: string[];
    discounts?: Array<{
      type: string;
      value: number;
      description: string;
    }>;
    privileges?: string[];
  };

  @Column({ type: 'jsonb' })
  criteria: {
    completionCriteria: string;
    validationRules: Record<string, any>;
    timeLimit?: number; // in hours
    maxAttempts?: number;
    requiredSkills?: string[];
    prerequisites?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  adaptiveDifficulty: {
    enabled: boolean;
    baseDifficulty: number;
    adjustmentRate: number;
    performanceThreshold: number;
    minDifficulty: number;
    maxDifficulty: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  personalization: {
    userPreferences: Record<string, any>;
    learningStyle?: string;
    interests?: string[];
    skillLevel?: string;
  };

  @Column({ type: 'datetime', nullable: true })
  startsAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endsAt: Date;

  @Column({ type: 'datetime', nullable: true })
  registrationDeadline: Date;

  @Column({ type: 'int', default: 0 })
  maxParticipants: number;

  @Column({ type: 'int', default: 0 })
  currentParticipants: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'jsonb', nullable: true })
  recurrence: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'float', default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @OneToMany(() => UserChallenge, userChallenge => userChallenge.challenge)
  userChallenges: UserChallenge[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastModifiedBy: string;
}

@Entity('user_challenges')
export class UserChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => Challenge, { nullable: false })
  @JoinColumn({ name: 'challengeId' })
  challenge: Challenge;

  @Column({ type: 'uuid' })
  @Index()
  challengeId: string;

  @Column({
    type: 'enum',
    enum: ChallengeStatus,
    default: ChallengeStatus.NOT_STARTED,
  })
  @Index()
  status: ChallengeStatus;

  @Column({ type: 'jsonb' })
  progress: {
    currentStep: number;
    completedObjectives: string[];
    overallProgress: number;
    timeSpent: number;
    lastActivity: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  objectiveProgress: {
    [objectiveId: string]: {
      current: number;
      target: number;
      completed: boolean;
      completedAt?: Date;
    };
  };

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'float', default: 1.0 })
  difficultyMultiplier: number;

  @Column({ type: 'jsonb', nullable: true })
  performance: {
    accuracy: number;
    speed: number;
    efficiency: number;
    quality: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  feedback: {
    type: 'auto' | 'peer' | 'mentor' | 'system';
    content: string;
    rating?: number;
    helpful: boolean;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    claimed: boolean;
    claimedAt?: Date;
    items: any[];
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;
}
