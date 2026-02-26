import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { UserAchievement } from './user-achievement.entity';
import { AchievementCategory } from '../enums/achievement-category.enum';
import { AchievementTier } from '../enums/achievement-tier.enum';
import { AchievementType } from '../enums/achievement-type.enum';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({
    type: 'enum',
    enum: AchievementCategory,
    default: AchievementCategory.GENERAL,
  })
  @Index()
  category: AchievementCategory;

  @Column({
    type: 'enum',
    enum: AchievementTier,
    default: AchievementTier.BRONZE,
  })
  @Index()
  tier: AchievementTier;

  @Column({
    type: 'enum',
    enum: AchievementType,
    default: AchievementType.CUMULATIVE,
  })
  type: AchievementType;

  @Column({ type: 'jsonb' })
  criteria: {
    type: string;
    target: number;
    conditions?: Record<string, any>;
    timeLimit?: number; // in hours
  };

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'int', default: 0 })
  tokenReward: number;

  @Column({ type: 'jsonb', nullable: true })
  rewards: {
    type: 'badge' | 'title' | 'avatar' | 'token' | 'discount';
    value: string | number;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  }[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  @Column({ type: 'boolean', default: false })
  isRepeatable: boolean;

  @Column({ type: 'int', nullable: true })
  maxCompletions: number;

  @Column({ type: 'jsonb', nullable: true })
  prerequisites: string[]; // achievement IDs

  @Column({ type: 'varchar', length: 100, nullable: true })
  badgeColor: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  badgeIcon: string;

  @Column({ type: 'float', default: 0 })
  rarity: number; // 0-1, higher is rarer

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => UserAchievement, userAchievement => userAchievement.achievement)
  userAchievements: UserAchievement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'datetime', nullable: true })
  lastModifiedBy: string;
}
