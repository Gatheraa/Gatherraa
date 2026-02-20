import { IsBoolean } from 'class-validator';

export class VoteReviewDto {
  @IsBoolean()
  isHelpful: boolean;
}
