import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from './entities/review.entity';
import { ReviewAttachment } from './entities/review-attachment.entity';
import { ReviewVote } from './entities/review-vote.entity';
import { ReviewReport } from './entities/review-report.entity';
import { EventRating } from './entities/event-rating.entity';
import { Event } from '../events/entities/event.entity';
import { ModerationService } from './moderation.service';
import { RatingService } from './rating.service';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review,
      ReviewAttachment,
      ReviewVote,
      ReviewReport,
      EventRating,
      Event,
    ]),
    NotificationsModule,
  ],
  controllers: [ReviewsController, FileUploadController],
  providers: [ReviewsService, ModerationService, RatingService, FileUploadService],
  exports: [ReviewsService, RatingService],
})
export class ReviewsModule {}
