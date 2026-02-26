import { IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FlagType, FlagEnvironment } from '../entities/feature-flag.entity';
import type { SegmentRule, RolloutConfig, ABTestConfig, TargetingRule } from '../entities/feature-flag.entity';

export class CreateFeatureFlagDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FlagType)
  type: FlagType;

  @IsEnum(FlagEnvironment)
  @IsOptional()
  environment?: FlagEnvironment;

  @IsOptional()
  defaultValue?: any;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  targetingRules?: TargetingRule[];

  @IsOptional()
  rolloutConfig?: RolloutConfig;

  @IsOptional()
  abTestConfig?: ABTestConfig;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  whitelist?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  blacklist?: string[];

  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  createdBy?: string;
}

export class UpdateFeatureFlagDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FlagType)
  @IsOptional()
  type?: FlagType;

  @IsEnum(FlagEnvironment)
  @IsOptional()
  environment?: FlagEnvironment;

  @IsOptional()
  defaultValue?: any;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  targetingRules?: TargetingRule[];

  @IsOptional()
  rolloutConfig?: RolloutConfig;

  @IsOptional()
  abTestConfig?: ABTestConfig;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  whitelist?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  blacklist?: string[];

  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}

export class EvaluateFlagDto {
  @IsString()
  flagKey: string;

  @IsString()
  userId: string;

  @IsOptional()
  context?: Record<string, any>;

  @IsOptional()
  defaultValue?: any;
}

export class BulkEvaluateFlagsDto {
  @IsArray()
  @IsString({ each: true })
  flagKeys: string[];

  @IsString()
  userId: string;

  @IsOptional()
  context?: Record<string, any>;
}
