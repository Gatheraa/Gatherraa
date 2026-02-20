import { IsString, IsOptional } from 'class-validator';

export class UpdateReviewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
