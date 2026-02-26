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
import { Achievement } from './achievement.entity';
import { User } from '../../users/entities/user.entity';

export enum AchievementStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CLAIMED = 'claimed',
  EXPIRED = 'expired',
}

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => Achievement, { nullable: false })
  @JoinColumn({ name: 'achievementId' })
  achievement: Achievement;

  @Column({ type: 'uuid' })
  @Index()
  achievementId: string;

  @Column({
    type: 'enum',
    enum: AchievementStatus,
    default: AchievementStatus.PENDING,
  })
  @Index()
  status: AchievementStatus;

  @Column({ type: 'jsonb' })
  progress: {
    current: number;
    target: number;
    percentage: number;
    lastUpdated: Date;
    milestones?: {
      reached: number[];
      next: number;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  evidence: {
    type: string;
    data: any;
    timestamp: Date;
    verified: boolean;
  }[];

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  claimedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  completionCount: number;

  @Column({ type: 'float', default: 0 })
  score: number; // Performance score for this achievement

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    claimed: boolean;
    claimedAt?: Date;
    type: string;
    value: any;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'int', default: 0 })
  shareCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;
}
