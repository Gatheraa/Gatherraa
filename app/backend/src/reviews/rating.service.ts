import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventRating } from './entities/event-rating.entity';
import { Review, ReviewStatus } from './entities/review.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(EventRating)
    private readonly eventRatingRepository: Repository<EventRating>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Calculate aggregate rating for an event (transactional)
   */
  async calculateAggregateRating(eventId: string): Promise<EventRating> {
    return await this.dataSource.transaction(async (manager) => {
      // Get all approved reviews for the event
      const reviews = await manager.find(Review, {
        where: {
          eventId,
          status: ReviewStatus.APPROVED,
        },
        select: ['rating'],
      });

      const totalReviews = reviews.length;
      let averageRating = 0;
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      if (totalReviews > 0) {
        // Calculate average
        const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
        averageRating = Math.round((sum / totalReviews) * 100) / 100; // Round to 2 decimal places

        // Calculate distribution
        reviews.forEach((review) => {
          ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
        });
      }

      // Find or create EventRating
      let eventRating = await manager.findOne(EventRating, {
        where: { eventId },
      });

      if (!eventRating) {
        eventRating = manager.create(EventRating, {
          eventId,
          averageRating,
          totalReviews,
          ratingDistribution,
          lastCalculatedAt: new Date(),
        });
      } else {
        eventRating.averageRating = averageRating;
        eventRating.totalReviews = totalReviews;
        eventRating.ratingDistribution = ratingDistribution;
        eventRating.lastCalculatedAt = new Date();
      }

      return await manager.save(eventRating);
    });
  }

  /**
   * Update event rating (wrapper for calculateAggregateRating)
   */
  async updateEventRating(eventId: string): Promise<EventRating> {
    return await this.calculateAggregateRating(eventId);
  }

  /**
   * Get rating summary for an event
   */
  async getRatingSummary(eventId: string): Promise<EventRating | null> {
    let eventRating = await this.eventRatingRepository.findOne({
      where: { eventId },
    });

    // If no rating exists, calculate it
    if (!eventRating) {
      eventRating = await this.calculateAggregateRating(eventId);
    }

    return eventRating;
  }

  /**
   * Recalculate rating for an event (useful for admin operations)
   */
  async recalculateRating(eventId: string): Promise<EventRating> {
    return await this.calculateAggregateRating(eventId);
  }
}
