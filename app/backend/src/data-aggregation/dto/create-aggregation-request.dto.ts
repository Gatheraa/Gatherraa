import { IsArray, IsEnum, IsOptional, IsNumber, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DataSourceConfigDto } from './data-source-config.dto';

export class CreateAggregationRequestDto {
  @IsArray()
  @Type(() => DataSourceConfigDto)
  dataSources: DataSourceConfigDto[];

  @IsEnum(['merge', 'override', 'combine'])
  @IsOptional()
  mergeStrategy?: 'merge' | 'override' | 'combine' = 'merge';

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(60000)
  timeout?: number = 10000;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(5)
  maxRetries?: number = 2;

  @IsEnum(['none', 'basic', 'full'])
  @IsOptional()
  validationLevel?: 'none' | 'basic' | 'full' = 'basic';
}
