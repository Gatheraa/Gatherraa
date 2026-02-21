import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DeliveryChannel, DeliveryStatus } from '../entities/notification-delivery.entity';

export class DeliveryStatusDto {
  @IsUUID()
  notificationId: string;

  @IsEnum(DeliveryChannel)
  channel: DeliveryChannel;

  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  providerMessageId?: string;
}

export class UpdateDeliveryReceiptDto {
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @IsOptional()
  @IsString()
  providerStatus?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;
}

export class DeliveryAnalyticsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(DeliveryChannel)
  channel?: DeliveryChannel;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class DeliveryResponseDto {
  id: string;
  notificationId: string;
  userId: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  recipientAddress?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  attemptCount: number;
  lastAttemptAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
