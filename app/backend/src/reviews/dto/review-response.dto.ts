import { Exclude, Expose, Type } from 'class-transformer';

export class UserSummaryDto {
  @Expose()
  id: string;

  @Expose()
  username: string | null;

  @Expose()
  avatar: string | null;
}

export class AttachmentResponseDto {
  @Expose()
  id: string;

  @Expose()
  type: string;

  @Expose()
  url: string;

  @Expose()
  thumbnailUrl: string | null;

  @Expose()
  filename: string;

  @Expose()
  mimeType: string;

  @Expose()
  size: number;
}

export class ReviewResponseDto {
  @Expose()
  id: string;

  @Expose()
  eventId: string;

  @Expose()
  userId: string;

  @Expose()
  rating: number;

  @Expose()
  title: string | null;

  @Expose()
  content: string;

  @Expose()
  status: string;

  @Expose()
  helpfulCount: number;

  @Expose()
  reportCount: number;

  @Expose()
  @Type(() => UserSummaryDto)
  user: UserSummaryDto;

  @Expose()
  @Type(() => AttachmentResponseDto)
  attachments: AttachmentResponseDto[];

  @Expose()
  userHasVoted?: boolean;

  @Expose()
  userVoteIsHelpful?: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class ReviewListResponseDto {
  @Expose()
  @Type(() => ReviewResponseDto)
  data: ReviewResponseDto[];

  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;
}
