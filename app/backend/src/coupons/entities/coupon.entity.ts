import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CouponStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  DEPLETED = 'depleted',
}

export enum StackabilityRule {
  NONE = 'none', // Cannot be combined with any other coupons
  ALL = 'all', // Can be combined with any other coupons
  CATEGORY = 'category', // Can be combined with coupons from same category
  EXCLUSIVE = 'exclusive', // Exclusive coupon, cannot be combined with others
}

export enum CouponScope {
  GLOBAL = 'global', // Can be used by any user
  USER_SPECIFIC = 'user_specific', // Can only be used by specific user
  AFFILIATE = 'affiliate', // Affiliate coupon
  EVENT_SPECIFIC = 'event_specific', // Specific to an event
  CATEGORY_SPECIFIC = 'category_specific', // Specific to a category
}

@Entity('coupons')
@Index(['code'], { unique: true })
@Index(['status', 'expiresAt'])
@Index(['createdBy', 'createdAt'])
@Index(['affiliateId', 'status'])
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  @Index()
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: CouponType,
  })
  type: CouponType;

  @Column({
    type: 'enum',
    enum: CouponStatus,
    default: CouponStatus.ACTIVE,
  })
  status: CouponStatus;

  @Column({
    type: 'enum',
    enum: CouponScope,
    default: CouponScope.GLOBAL,
  })
  scope: CouponScope;

  // Discount configuration
  @Column('decimal', { precision: 10, scale: 2 })
  discountValue: number; // Percentage (0-100) or fixed amount

  @Column({ nullable: true })
  currency?: string; // Required for fixed discounts

  // Usage limits
  @Column({ type: 'int', default: null, nullable: true })
  maxUses?: number; // Total uses allowed

  @Column({ type: 'int', default: null, nullable: true })
  maxUsesPerUser?: number; // Uses per user

  @Column({ type: 'int', default: 0 })
  currentUses: number; // Current total uses

  // Expiration
  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  startsAt?: Date; // When coupon becomes valid

  // Stackability
  @Column({
    type: 'enum',
    enum: StackabilityRule,
    default: StackabilityRule.ALL,
  })
  stackabilityRule: StackabilityRule;

  @Column({ length: 100, nullable: true })
  category?: string; // For category-based stackability

  // Scope restrictions
  @Column('uuid', { nullable: true })
  userId?: string; // For user-specific coupons

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column('uuid', { nullable: true })
  eventId?: string; // For event-specific coupons

  @Column('uuid', { nullable: true })
  categoryId?: string; // For category-specific coupons

  // Affiliate support
  @Column('uuid', { nullable: true })
  @Index()
  affiliateId?: string; // User who created the affiliate coupon

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'affiliateId' })
  affiliate?: User;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  affiliateCommission: number; // Commission percentage for affiliate

  // Minimum requirements
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minimumAmount: number; // Minimum order amount

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maximumDiscount?: number; // Maximum discount amount for percentage coupons

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    tags?: string[];
    applicableProducts?: string[];
    excludedProducts?: string[];
    applicableCategories?: string[];
    excludedCategories?: string[];
    customData?: Record<string, any>;
  };

  // Audit fields
  @Column('uuid')
  createdBy: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdBy' })
  creator?: User;

  @Column('uuid', { nullable: true })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => CouponUsage, (usage) => usage.coupon, {
    eager: false,
    cascade: false,
  })
  usages: CouponUsage[];
}

@Entity('coupon_usages')
@Index(['couponId', 'userId'])
@Index(['couponId', 'usedAt'])
@Index(['userId', 'usedAt'])
export class CouponUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  couponId: string;

  @ManyToOne(() => Coupon, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid', { nullable: true })
  orderId?: string; // Reference to the order/payment

  @Column('decimal', { precision: 10, scale: 2 })
  discountAmount: number; // Actual discount applied

  @Column({ nullable: true })
  currency?: string;

  @Column({ type: 'jsonb', nullable: true })
  appliedTo?: {
    items?: Array<{
      id: string;
      type: string;
      originalAmount: number;
      discountAmount: number;
    }>;
    totalOriginalAmount: number;
    totalDiscountAmount: number;
  };

  @Column({ type: 'timestamp' })
  usedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
