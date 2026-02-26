import { IsString, IsOptional, IsObject, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class CreateUserBehaviorDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  behaviorType: string;

  @IsOptional()
  @IsObject()
  behaviorData?: Record<string, any>;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsString()
  targetEntity?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsObject()
  userProperties?: Record<string, any>;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isConverted?: boolean;

  @IsOptional()
  @IsObject()
  attribution?: Record<string, any>;
}
