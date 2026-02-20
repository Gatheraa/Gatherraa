import { IsString, IsOptional, IsObject, IsArray, IsEnum, IsBoolean } from 'class-validator';

export enum ReportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  PDF = 'pdf'
}

export class CreateReportDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  filters: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  columns: string[];

  @IsEnum(ReportFormat)
  format: ReportFormat;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean;

  @IsOptional()
  @IsObject()
  scheduleConfig?: Record<string, any>;
}