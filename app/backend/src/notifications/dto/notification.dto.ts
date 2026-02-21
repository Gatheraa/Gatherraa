import { IsString, IsEmail, IsEnum, IsOptional, IsJSON, IsUUID, IsDateString, IsBoolean, IsArray } from 'class-validator';
import { NotificationType, NotificationCategory, NotificationStatus } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsJSON()
  data?: Record<string, any>;

  @IsOptional()
  @IsJSON()
  metadata?: {
    eventId?: string;
    ticketId?: string;
    reviewId?: string;
    userId?: string;
    actionUrl?: string;
  };

  @IsOptional()
  @IsDateString()
  scheduledFor?: Date;

  @IsOptional()
  @IsBoolean()
  sendImmediately?: boolean;
}

export class SendNotificationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsEnum(NotificationType, { each: true })
  types: NotificationType[];

  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsJSON()
  data?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledFor?: Date;
}

export class UpdateNotificationStatusDto {
  @IsEnum(NotificationStatus)
  status: NotificationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class NotificationResponseDto {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  status: NotificationStatus;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
}

export class CreateBulkNotificationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsEnum(NotificationType, { each: true })
  types: NotificationType[];

  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsJSON()
  data?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledFor?: Date;

  @IsOptional()
  @IsBoolean()
  respectPreferences?: boolean;
}

export class MarkAsReadDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  notificationIds?: string[];

  @IsOptional()
  @IsBoolean()
  markAllAsRead?: boolean;
}

export class NotificationPaginationDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  limit: number = 20;

  @IsOptional()
  offset: number = 0;
}
