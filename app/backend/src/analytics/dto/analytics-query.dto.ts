import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, IsBoolean } from 'class-validator';

export enum TimePeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom'
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(TimePeriod)
  timePeriod?: TimePeriod = TimePeriod.LAST_7_DAYS;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  metricType?: string;

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsNumber()
  limit?: number = 100;

  @IsOptional()
  @IsNumber()
  offset?: number = 0;

  @IsOptional()
  @IsBoolean()
  includeAnomalies?: boolean = false;
}