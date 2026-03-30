import {
  IsString,
  IsUrl,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class DataSourceConfigDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsUrl()
  endpoint: string;

  @IsNumber()
  @Min(1)
  @Max(10)
  priority: number;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(60000)
  timeout?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  retryCount?: number;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;

  @IsEnum(['GET', 'POST', 'PUT', 'DELETE'])
  @IsOptional()
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';

  @IsOptional()
  body?: any;

  @IsOptional()
  transform?: string;

  @IsOptional()
  cacheTtl?: number;

  @IsOptional()
  enabled?: boolean = true;
}
