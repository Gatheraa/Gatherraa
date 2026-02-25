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
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GuildType } from '../enums/guild-type.enum';
import { GuildRole } from '../enums/guild-role.enum';

@Entity('guilds')
export class Guild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  tag: string; // e.g., [DEV], [LRN]

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bannerUrl: string;

  @Column({
    type: 'enum',
    enum: GuildType,
    default: GuildType.LEARNING,
  })
  @Index()
  type: GuildType;

  @Column({ type: 'jsonb' })
  settings: {
    isPublic: boolean;
    requireApproval: boolean;
    maxMembers: number;
    level: number;
    experience: number;
    nextLevelExperience: number;
  };

  @Column({ type: 'jsonb' })
  perks: {
    bonusMultiplier: number;
    exclusiveChallenges: boolean;
    privateLeaderboards: boolean;
    customBadges: boolean;
    guildEvents: boolean;
  };

  @Column({ type: 'jsonb' })
  requirements: {
    minLevel?: number;
    minPoints?: number;
    requiredSkills?: string[];
    invitationCode?: string;
    applicationQuestions?: string[];
  };

  @Column({ type: 'jsonb' })
  statistics: {
    totalMembers: number;
    activeMembers: number;
    totalPoints: number;
    averageMemberLevel: number;
    challengesCompleted: number;
    eventsHosted: number;
    collaborationScore: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  achievements: {
    guildId: string;
    unlockedAt: Date;
    progress: number;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  leaderboard: {
    ranking: number;
    points: number;
    weeklyChange: number;
    monthlyChange: number;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'datetime', nullable: true })
  establishedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'leaderId' })
  leader: User;

  @Column({ type: 'uuid' })
  @Index()
  leaderId: string;

  @OneToMany(() => GuildMember, member => member.guild)
  members: GuildMember[];

  @OneToMany(() => GuildChallenge, challenge => challenge.guild)
  challenges: GuildChallenge[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;
}

@Entity('guild_members')
export class GuildMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { nullable: false })
  @JoinColumn({ name: 'guildId' })
  guild: Guild;

  @Column({ type: 'uuid' })
  @Index()
  guildId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: GuildRole,
    default: GuildRole.MEMBER,
  })
  @Index()
  role: GuildRole;

  @Column({ type: 'jsonb' })
  contributions: {
    points: number;
    challenges: number;
    events: number;
    mentoring: number;
    collaboration: number;
  };

  @Column({ type: 'int', default: 0 })
  reputation: number;

  @Column({ type: 'float', default: 0 })
  activityScore: number;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ type: 'jsonb', nullable: true })
  badges: {
    type: string;
    name: string;
    description: string;
    earnedAt: Date;
  }[];

  @Column({ type: 'datetime' })
  joinedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  promotedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastActivityAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('guild_challenges')
export class GuildChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Guild, { nullable: false })
  @JoinColumn({ name: 'guildId' })
  guild: Guild;

  @Column({ type: 'uuid' })
  @Index()
  guildId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb' })
  objectives: {
    id: string;
    description: string;
    target: number;
    points: number;
    required: boolean;
  }[];

  @Column({ type: 'jsonb' })
  rewards: {
    guildPoints: number;
    memberPoints: number;
    badges?: string[];
    privileges?: string[];
  };

  @Column({ type: 'datetime' })
  startsAt: Date;

  @Column({ type: 'datetime' })
  endsAt: Date;

  @Column({ type: 'jsonb' })
  progress: {
    current: number;
    target: number;
    percentage: number;
    contributors: string[];
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
