import { IsString, IsOptional, IsDateString, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class MarketTrendQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(['last_7_days', 'last_30_days', 'last_90_days', 'last_year'])
  timePeriod?: string = 'last_30_days';

  @IsOptional()
  @IsBoolean()
  includePredictions?: boolean = true;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  dataSource?: string;

  @IsOptional()
  @Type(() => Number)
  minConfidence?: number;

  @IsOptional()
  @IsEnum(['price', 'volume', 'both'])
  sortBy?: string = 'timestamp';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: string = 'desc';
}
