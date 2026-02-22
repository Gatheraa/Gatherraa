import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  Min,
  Max,
  Length,
  IsArray,
  IsObject,
  ValidateNested,
  IsPositive,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CouponType,
  CouponStatus,
  StackabilityRule,
  CouponScope,
} from '../entities/coupon.entity';

export class CreateCouponDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsString()
  @Length(1, 255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsEnum(CouponScope)
  @IsOptional()
  scope?: CouponScope = CouponScope.GLOBAL;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsEnum(StackabilityRule)
  @IsOptional()
  stackabilityRule?: StackabilityRule = StackabilityRule.ALL;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  affiliateId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  affiliateCommission?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    applicableProducts?: string[];
    excludedProducts?: string[];
    applicableCategories?: string[];
    excludedCategories?: string[];
    customData?: Record<string, any>;
  };
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsEnum(StackabilityRule)
  stackabilityRule?: StackabilityRule;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    applicableProducts?: string[];
    excludedProducts?: string[];
    applicableCategories?: string[];
    excludedCategories?: string[];
    customData?: Record<string, any>;
  };
}

export class ValidateCouponDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  orderAmount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingCoupons?: string[]; // Array of coupon codes already applied

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

export class ApplyCouponDto {
  @IsString()
  @Length(1, 50)
  code: string;

  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0)
  orderAmount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingCoupons?: string[];

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

export class BulkGenerateCouponsDto {
  @IsString()
  @Length(1, 255)
  namePrefix: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(CouponType)
  type: CouponType;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  @Min(1)
  @Max(10000)
  count: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsEnum(StackabilityRule)
  @IsOptional()
  stackabilityRule?: StackabilityRule = StackabilityRule.ALL;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;
}

export class CouponQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @IsOptional()
  @IsEnum(CouponType)
  type?: CouponType;

  @IsOptional()
  @IsEnum(CouponScope)
  scope?: CouponScope;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsUUID()
  affiliateId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  expiresBefore?: string;

  @IsOptional()
  @IsDateString()
  expiresAfter?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class CouponValidationResultDto {
  @IsBoolean()
  isValid: boolean;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  coupon?: {
    id: string;
    code: string;
    name: string;
    type: string;
    discountValue: number;
    currency?: string;
    minimumAmount: number;
    maximumDiscount?: number;
  };

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;
}

export class CouponApplicationResultDto {
  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsObject()
  coupon?: {
    id: string;
    code: string;
    name: string;
    type: string;
    discountValue: number;
    currency?: string;
  };

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  finalAmount?: number;

  @IsOptional()
  @IsString()
  usageId?: string;
}
