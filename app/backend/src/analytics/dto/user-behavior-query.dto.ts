import { IsString, IsOptional, IsDateString, IsEnum, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UserBehaviorQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(['last_7_days', 'last_30_days', 'last_90_days'])
  timePeriod?: string = 'last_30_days';

  @IsOptional()
  @IsString()
  behaviorType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number = 0;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsBoolean()
  isConverted?: boolean;
}
