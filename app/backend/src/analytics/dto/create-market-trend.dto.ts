import { IsString, IsOptional, IsObject, IsNumber, IsBoolean, IsDateString, IsEnum } from 'class-validator';

export class CreateMarketTrendDto {
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsNumber()
  averagePrice: number;

  @IsNumber()
  minPrice: number;

  @IsNumber()
  maxPrice: number;

  @IsNumber()
  totalVolume: number;

  @IsNumber()
  totalValue: number;

  @IsOptional()
  @IsNumber()
  priceChange?: number;

  @IsOptional()
  @IsNumber()
  volumeChange?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  seasonality?: Record<string, any>;

  @IsOptional()
  @IsObject()
  predictions?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsString()
  dataSource?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
