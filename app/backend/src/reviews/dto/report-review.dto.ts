import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ReportReason } from '../entities/review-report.entity';

export class ReportReviewDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsString()
  @IsOptional()
  description?: string;
}
