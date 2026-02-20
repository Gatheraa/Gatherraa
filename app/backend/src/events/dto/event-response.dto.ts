import { Exclude, Expose, Type } from 'class-transformer';

export class EventRatingSummaryDto {
  @Expose()
  averageRating: number;

  @Expose()
  totalReviews: number;

  @Expose()
  ratingDistribution: Record<number, number>;
}

export class EventResponseDto {
  @Expose()
  id: string;

  @Expose()
  contractAddress: string;

  @Expose()
  name: string;

  @Expose()
  description: string | null;

  @Expose()
  startTime: Date;

  @Expose()
  endTime: Date | null;

  @Expose()
  organizerId: string;

  @Expose()
  @Type(() => EventRatingSummaryDto)
  ratingSummary?: EventRatingSummaryDto;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
