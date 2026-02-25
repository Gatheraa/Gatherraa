import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FlagType {
  BOOLEAN = 'boolean',
  ROLLOUT = 'rollout',
  AB_TEST = 'ab_test',
  KILL_SWITCH = 'kill_switch',
}

export enum FlagEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum FlagStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export interface SegmentRule {
  field: string; // e.g., 'role', 'email', 'country', 'customAttribute'
  operator: 'equals' | 'notEquals' | 'in' | 'notIn' | 'contains' | 'greaterThan' | 'lessThan';
  value: any;
}

export interface RolloutConfig {
  percentage: number; // 0-100
  seed?: string; // For consistent hashing
}

export interface ABTestConfig {
  variants: {
    name: string;
    weight: number; // 0-100
    value: any;
  }[];
  exposurePercentage?: number; // % of users exposed to test
}

export interface TargetingRule {
  name: string;
  description?: string;
  segments: SegmentRule[][];
  value: any;
  rollout?: RolloutConfig;
}

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  key: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: FlagType,
    default: FlagType.BOOLEAN,
  })
  type: FlagType;

  @Column({
    type: 'enum',
    enum: FlagEnvironment,
    default: FlagEnvironment.DEVELOPMENT,
  })
  environment: FlagEnvironment;

  @Column({
    type: 'enum',
    enum: FlagStatus,
    default: FlagStatus.ACTIVE,
  })
  status: FlagStatus;

  @Column({ type: 'simple-json', nullable: true })
  defaultValue: any;

  @Column({ type: 'simple-json', nullable: true })
  targetingRules: TargetingRule[];

  @Column({ type: 'simple-json', nullable: true })
  rolloutConfig: RolloutConfig;

  @Column({ type: 'simple-json', nullable: true })
  abTestConfig: ABTestConfig;

  // Whitelisted user IDs that always see the feature
  @Column({ type: 'simple-array', nullable: true })
  whitelist: string[];

  // Blacklisted user IDs that never see the feature
  @Column({ type: 'simple-array', nullable: true })
  blacklist: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  archivedAt: Date;
}
