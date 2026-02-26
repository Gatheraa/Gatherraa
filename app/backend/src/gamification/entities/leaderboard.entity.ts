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
import { LeaderboardType } from '../enums/leaderboard-type.enum';
import { LeaderboardPeriod } from '../enums/leaderboard-period.enum';

@Entity('leaderboards')
export class Leaderboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: LeaderboardType,
    default: LeaderboardType.POINTS,
  })
  @Index()
  type: LeaderboardType;

  @Column({
    type: 'enum',
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.ALL_TIME,
  })
  @Index()
  period: LeaderboardPeriod;

  @Column({ type: 'jsonb' })
  criteria: {
    metric: string;
    algorithm: 'sum' | 'average' | 'weighted' | 'exponential_decay';
    weights?: Record<string, number>;
    filters?: Record<string, any>;
    decayRate?: number; // For exponential decay
  };

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    rank: number;
    type: 'token' | 'badge' | 'title' | 'discount' | 'privilege';
    value: any;
    description?: string;
  }[];

  @Column({ type: 'int', default: 100 })
  maxEntries: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  allowTies: boolean;

  @Column({ type: 'jsonb', nullable: true })
  displaySettings: {
    showRank: boolean;
    showScore: boolean;
    showUser: boolean;
    showProgress: boolean;
    theme: 'default' | 'dark' | 'colorful' | 'minimal';
  };

  @Column({ type: 'jsonb', nullable: true })
  eligibility: {
    minLevel?: number;
    minPoints?: number;
    requiredRoles?: string[];
    excludeRoles?: string[];
    customCriteria?: Record<string, any>;
  };

  @Column({ type: 'datetime', nullable: true })
  startsAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endsAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastCalculatedAt: Date;

  @Column({ type: 'int', default: 300 }) // 5 minutes
  calculationInterval: number; // in seconds

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  color: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @OneToMany(() => LeaderboardEntry, entry => entry.leaderboard)
  entries: LeaderboardEntry[];
}

@Entity('leaderboard_entries')
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Leaderboard, { nullable: false })
  @JoinColumn({ name: 'leaderboardId' })
  leaderboard: Leaderboard;

  @Column({ type: 'uuid' })
  @Index()
  leaderboardId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ type: 'int' })
  @Index()
  rank: number;

  @Column({ type: 'float' })
  @Index()
  score: number;

  @Column({ type: 'jsonb' })
  breakdown: {
    [key: string]: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'int', default: 0 })
  previousRank: number;

  @Column({ type: 'int', default: 0 })
  rankChange: number;

  @Column({ type: 'boolean', default: false })
  isTied: boolean;

  @Column({ type: 'int', default: 1 })
  tieCount: number;
}
