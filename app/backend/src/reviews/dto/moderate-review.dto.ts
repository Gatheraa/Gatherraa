import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ReviewStatus } from '../entities/review.entity';

export class ModerateReviewDto {
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @IsString()
  @IsOptional()
  moderationReason?: string;
}
