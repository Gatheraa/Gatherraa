import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import { Review, ReviewStatus } from './entities/review.entity';
import { ReviewAttachment } from './entities/review-attachment.entity';
import { ReviewVote } from './entities/review-vote.entity';
import { ReviewReport, ReportReason } from './entities/review-report.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { Event } from '../events/entities/event.entity';
import { ModerationService } from './moderation.service';
import { RatingService } from './rating.service';
import { FileUploadService } from './file-upload.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface ReviewFilters {
  eventId?: string;
  userId?: string;
  rating?: number;
  status?: ReviewStatus;
  hasAttachments?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export type ReviewSort = 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'most_helpful';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewAttachment)
    private readonly attachmentRepository: Repository<ReviewAttachment>,
    @InjectRepository(ReviewVote)
    private readonly voteRepository: Repository<ReviewVote>,
    @InjectRepository(ReviewReport)
    private readonly reportRepository: Repository<ReviewReport>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly moderationService: ModerationService,
    private readonly ratingService: RatingService,
    private readonly fileUploadService: FileUploadService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new review
   */
  async create(
    eventId: string,
    createReviewDto: CreateReviewDto,
    user: User,
  ): Promise<Review> {
    // Check if event exists
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    // Check if user already reviewed this event
    const existingReview = await this.reviewRepository.findOne({
      where: { eventId, userId: user.id },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this event');
    }

    // Determine initial status based on moderation
    const initialStatus = this.moderationService.getInitialStatus(
      createReviewDto.content,
      createReviewDto.title,
    );

    const created = await this.dataSource.transaction(async (manager) => {
      // Create review
      const review = manager.create(Review, {
        eventId,
        userId: user.id,
        rating: createReviewDto.rating,
        title: createReviewDto.title || null,
        content: createReviewDto.content,
        status: initialStatus,
      });

      const savedReview = await manager.save(review);

      // Create attachments if provided
      if (createReviewDto.attachments && createReviewDto.attachments.length > 0) {
        const attachments = createReviewDto.attachments.map((att) =>
          manager.create(ReviewAttachment, {
            reviewId: savedReview.id,
            // DTO uses string literals; cast to enum type
            type: att.type as any,
            url: att.url,
            thumbnailUrl: att.thumbnailUrl || null,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
          } as any),
        );
        await manager.save(ReviewAttachment, attachments);
      }

      // Recalculate event rating
      await this.ratingService.calculateAggregateRating(eventId);

      // Send notifications
      if (initialStatus === ReviewStatus.APPROVED) {
        await this.notificationsService.sendReviewNotification(savedReview, event);
      } else if (initialStatus === ReviewStatus.FLAGGED) {
        await this.notificationsService.sendModerationNotification(savedReview, event);
      }

      return savedReview;
    });

    // Reload with relations outside the transaction
    const fullReview = await this.reviewRepository.findOne({
      where: { id: created.id },
      relations: ['user', 'attachments', 'event'],
    });

    if (!fullReview) {
      throw new NotFoundException('Review not found after creation');
    }

    return fullReview;
  }

  /**
   * Find all reviews with filtering and sorting
   */
  async findAll(
    filters: ReviewFilters = {},
    sort: ReviewSort = 'newest',
    page: number = 1,
    limit: number = 20,
    currentUser?: User,
  ): Promise<[Review[], number]> {
    const skip = (page - 1) * limit;
    const queryBuilder = this.reviewRepository.createQueryBuilder('review');

    // Apply filters
    if (filters.eventId) {
      queryBuilder.andWhere('review.eventId = :eventId', { eventId: filters.eventId });
    }
    if (filters.userId) {
      queryBuilder.andWhere('review.userId = :userId', { userId: filters.userId });
    }
    if (filters.rating) {
      queryBuilder.andWhere('review.rating = :rating', { rating: filters.rating });
    }
    if (filters.status) {
      queryBuilder.andWhere('review.status = :status', { status: filters.status });
    } else {
      // By default, only show approved reviews to non-moderators
      if (!currentUser || (!currentUser.roles.includes(UserRole.ADMIN))) {
        queryBuilder.andWhere('review.status = :status', { status: ReviewStatus.APPROVED });
      }
    }
    if (filters.hasAttachments) {
      queryBuilder.andWhere('EXISTS (SELECT 1 FROM review_attachments WHERE reviewId = review.id)');
    }
    if (filters.minDate) {
      queryBuilder.andWhere('review.createdAt >= :minDate', { minDate: filters.minDate });
    }
    if (filters.maxDate) {
      queryBuilder.andWhere('review.createdAt <= :maxDate', { maxDate: filters.maxDate });
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        queryBuilder.orderBy('review.createdAt', 'DESC');
        break;
      case 'oldest':
        queryBuilder.orderBy('review.createdAt', 'ASC');
        break;
      case 'highest_rated':
        queryBuilder.orderBy('review.rating', 'DESC');
        break;
      case 'lowest_rated':
        queryBuilder.orderBy('review.rating', 'ASC');
        break;
      case 'most_helpful':
        queryBuilder.orderBy('review.helpfulCount', 'DESC');
        break;
    }

    // Load relations
    queryBuilder
      .leftJoinAndSelect('review.user', 'user')
      .leftJoinAndSelect('review.attachments', 'attachments')
      .leftJoinAndSelect('review.event', 'event')
      .leftJoinAndSelect('review.helpfulVotes', 'helpfulVotes');

    // Pagination
    queryBuilder.skip(skip).take(limit);

    return await queryBuilder.getManyAndCount();
  }

  /**
   * Find one review by ID
   */
  async findOne(id: string, currentUser?: User): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user', 'attachments', 'event', 'moderator', 'helpfulVotes'],
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Check if user can view this review
    if (
      review.status !== ReviewStatus.APPROVED &&
      (!currentUser ||
        (review.userId !== currentUser.id &&
          !currentUser.roles.includes(UserRole.ADMIN)))
    ) {
      throw new ForbiddenException('You do not have permission to view this review');
    }

    return review;
  }

  /**
   * Update a review
   */
  async update(id: string, updateReviewDto: UpdateReviewDto, user: User): Promise<Review> {
    const review = await this.findOne(id, user);

    // Check if user is the author
    if (review.userId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    // Check if review can be updated (not rejected)
    if (review.status === ReviewStatus.REJECTED) {
      throw new BadRequestException('Cannot update a rejected review');
    }

    // Update fields
    if (updateReviewDto.title !== undefined) {
      review.title = updateReviewDto.title || null;
    }
    if (updateReviewDto.content !== undefined) {
      review.content = updateReviewDto.content;
      // Re-check moderation if content changed
      const newStatus = this.moderationService.getInitialStatus(
        review.content,
        review.title,
      );
      if (newStatus !== review.status) {
        review.status = newStatus;
        review.moderatedAt = null;
        review.moderatorId = null;
        review.moderationReason = null;
      }
    }

    const updatedReview = await this.reviewRepository.save(review);

    // Recalculate rating if content changed
    if (updateReviewDto.content !== undefined) {
      await this.ratingService.updateEventRating(review.eventId);
    }

    return await this.findOne(updatedReview.id, user);
  }

  /**
   * Delete a review
   */
  async delete(id: string, user: User): Promise<void> {
    const review = await this.findOne(id, user);

    // Check permissions
    if (review.userId !== user.id && !user.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const eventId = review.eventId;

    await this.dataSource.transaction(async (manager) => {
      // Delete attachments (and files)
      if (review.attachments && review.attachments.length > 0) {
        for (const attachment of review.attachments) {
          await this.fileUploadService.deleteFile(attachment.url);
        }
        await manager.remove(ReviewAttachment, review.attachments);
      }

      // Delete votes
      const votes = await manager.find(ReviewVote, { where: { reviewId: review.id } });
      if (votes.length > 0) {
        await manager.remove(ReviewVote, votes);
      }

      // Delete reports
      const reports = await manager.find(ReviewReport, { where: { reviewId: review.id } });
      if (reports.length > 0) {
        await manager.remove(ReviewReport, reports);
      }

      // Delete review
      await manager.remove(Review, review);

      // Recalculate rating
      await this.ratingService.calculateAggregateRating(eventId);
    });
  }

  /**
   * Vote helpful/unhelpful on a review
   */
  async voteHelpful(reviewId: string, isHelpful: boolean, user: User): Promise<Review> {
    const review = await this.findOne(reviewId);

    // Check if user already voted
    const existingVote = await this.voteRepository.findOne({
      where: { reviewId, userId: user.id },
    });

    return await this.dataSource.transaction(async (manager) => {
      if (existingVote) {
        if (existingVote.isHelpful === isHelpful) {
          // Remove vote if clicking same vote
          await manager.remove(ReviewVote, existingVote);
          review.helpfulCount = Math.max(0, review.helpfulCount - 1);
        } else {
          // Update vote
          existingVote.isHelpful = isHelpful;
          await manager.save(ReviewVote, existingVote);
          // No change to helpfulCount (switching vote)
        }
      } else {
        // Create new vote
        const vote = manager.create(ReviewVote, {
          reviewId,
          userId: user.id,
          isHelpful,
        });
        await manager.save(ReviewVote, vote);
        if (isHelpful) {
          review.helpfulCount += 1;
        }
      }

      await manager.save(Review, review);
      return await this.findOne(reviewId);
    });
  }

  /**
   * Report a review
   */
  async report(
    reviewId: string,
    reason: ReportReason,
    description: string | undefined,
    user: User,
  ): Promise<ReviewReport> {
    const review = await this.findOne(reviewId);

    // Check if user already reported this review
    const existingReport = await this.reportRepository.findOne({
      where: { reviewId, reporterId: user.id },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this review');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Create report
      const report = manager.create(ReviewReport, {
        reviewId,
        reporterId: user.id,
        reason,
        description: description || null,
      });

      const savedReport = await manager.save(ReviewReport, report);

      // Update report count
      review.reportCount += 1;
      await manager.save(Review, review);

      // Send notification if threshold reached
      await this.notificationsService.sendReportNotification(
        review,
        review.event,
        review.reportCount,
      );

      return savedReport;
    });
  }

  /**
   * Moderate a review (approve/reject/flag)
   */
  async moderate(
    reviewId: string,
    status: ReviewStatus,
    moderationReason: string | undefined,
    moderator: User,
  ): Promise<Review> {
    // Check if user is moderator or admin
    if (!moderator.roles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only admins can moderate reviews');
    }

    const review = await this.findOne(reviewId);

    review.status = status;
    review.moderatorId = moderator.id;
    review.moderatedAt = new Date();
    review.moderationReason = moderationReason || null;

    const moderatedReview = await this.reviewRepository.save(review);

    // Recalculate rating if status changed to/from approved
    if (status === ReviewStatus.APPROVED || review.status === ReviewStatus.APPROVED) {
      await this.ratingService.updateEventRating(review.eventId);
    }

    // Send notification to review author
    await this.notificationsService.sendModerationResultNotification(
      moderatedReview,
      status,
      moderationReason,
    );

    return await this.findOne(reviewId);
  }

  /**
   * Get moderation queue (pending/flagged reviews)
   */
  async getModerationQueue(
    page: number = 1,
    limit: number = 20,
  ): Promise<[Review[], number]> {
    const skip = (page - 1) * limit;

    return await this.reviewRepository.findAndCount({
      where: [
        { status: ReviewStatus.PENDING },
        { status: ReviewStatus.FLAGGED },
      ],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['user', 'attachments', 'event'],
    });
  }
}
