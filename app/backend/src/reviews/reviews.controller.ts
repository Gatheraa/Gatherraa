import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReviewsService, ReviewFilters, ReviewSort } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { VoteReviewDto } from './dto/vote-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { ReviewResponseDto, ReviewListResponseDto } from './dto/review-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { ReviewStatus } from './entities/review.entity';
import { ReportReason } from './entities/review-report.entity';
import { plainToInstance } from 'class-transformer';
import { FileUploadService } from './file-upload.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Post('events/:eventId/reviews')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Param('eventId') eventId: string,
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: User,
    @UploadedFiles() files?: Express.Multer.File[],
  ): Promise<ReviewResponseDto> {
    // Handle file uploads if provided
    if (files && files.length > 0) {
      this.fileUploadService.validateTotalSize(files);
      const uploadedFiles = await this.fileUploadService.uploadMultiple(files);
      createReviewDto.attachments = uploadedFiles.map((file) => ({
        url: file.url,
        type: file.type,
        thumbnailUrl: file.thumbnailUrl,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
      }));
    }

    const review = await this.reviewsService.create(eventId, createReviewDto, user);
    return this.toResponseDto(review, user);
  }

  @Get('events/:eventId/reviews')
  async findAllForEvent(
    @Param('eventId') eventId: string,
    @Query('sort', new DefaultValuePipe('newest')) sort: string,
    @Query('rating') rating: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @CurrentUser() user?: User,
  ): Promise<ReviewListResponseDto> {
    const filters: ReviewFilters = {
      eventId,
      rating: rating ? parseInt(rating.toString()) : undefined,
    };

    const [reviews, total] = await this.reviewsService.findAll(
      filters,
      (sort as ReviewSort) || 'newest',
      page,
      limit,
      user,
    );

    return {
      data: reviews.map((review) => this.toResponseDto(review, user)),
      total,
      page,
      limit,
    };
  }

  @Get()
  async findAll(
    @Query('eventId') eventId: string,
    @Query('userId') userId: string,
    @Query('rating') rating: number,
    @Query('status') status: ReviewStatus,
    @Query('hasAttachments') hasAttachments: boolean,
    @Query('sort', new DefaultValuePipe('newest')) sort: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @CurrentUser() user?: User,
  ): Promise<ReviewListResponseDto> {
    const filters: ReviewFilters = {
      eventId,
      userId,
      rating: rating ? parseInt(rating.toString()) : undefined,
      status,
      hasAttachments: hasAttachments === true,
    };

    const [reviews, total] = await this.reviewsService.findAll(
      filters,
      (sort as ReviewSort) || 'newest',
      page,
      limit,
      user,
    );

    return {
      data: reviews.map((review) => this.toResponseDto(review, user)),
      total,
      page,
      limit,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user?: User): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.findOne(id, user);
    return this.toResponseDto(review, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: User,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.update(id, updateReviewDto, user);
    return this.toResponseDto(review, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: User): Promise<{ message: string }> {
    await this.reviewsService.delete(id, user);
    return { message: 'Review deleted successfully' };
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  async vote(
    @Param('id') id: string,
    @Body() voteDto: VoteReviewDto,
    @CurrentUser() user: User,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.voteHelpful(id, voteDto.isHelpful, user);
    return this.toResponseDto(review, user);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async report(
    @Param('id') id: string,
    @Body() reportDto: ReportReviewDto,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.reviewsService.report(id, reportDto.reason, reportDto.description, user);
    return { message: 'Review reported successfully' };
  }

  @Get('moderation/queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getModerationQueue(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ReviewListResponseDto> {
    const [reviews, total] = await this.reviewsService.getModerationQueue(page, limit);

    return {
      data: reviews.map((review) => this.toResponseDto(review)),
      total,
      page,
      limit,
    };
  }

  @Post(':id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async moderate(
    @Param('id') id: string,
    @Body() moderateDto: ModerateReviewDto,
    @CurrentUser() user: User,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.moderate(
      id,
      moderateDto.status,
      moderateDto.moderationReason,
      user,
    );
    return this.toResponseDto(review);
  }

  /**
   * Convert Review entity to Response DTO
   */
  private toResponseDto(review: any, currentUser?: User): ReviewResponseDto {
    const dto = plainToInstance(ReviewResponseDto, {
      ...review,
      user: review.user
        ? {
            id: review.user.id,
            username: review.user.username,
            avatar: review.user.avatar,
          }
        : undefined,
      attachments: review.attachments || [],
    });

    // Add user vote information if user is logged in
    if (currentUser && review.helpfulVotes) {
      const userVote = review.helpfulVotes.find((vote: any) => vote.userId === currentUser.id);
      if (userVote) {
        dto.userHasVoted = true;
        dto.userVoteIsHelpful = userVote.isHelpful;
      }
    }

    return dto;
  }
}
