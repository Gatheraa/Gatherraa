import { IsString, IsOptional, IsObject, IsDateString, IsEnum } from 'class-validator';

export enum EventType {
  VIEW = 'view',
  REGISTER = 'register',
  ATTEND = 'attend',
  SHARE = 'share',
  INTERACT = 'interact',
  CANCEL = 'cancel',
  CHECK_IN = 'check_in',
  FEEDBACK = 'feedback',
}

export class CreateEventAnalyticsDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(EventType)
  eventType: EventType;

  @IsObject()
  metrics: Record<string, any>;

  @IsObject()
  @IsOptional()
  eventData?: Record<string, any>;

  @IsObject()
  @IsOptional()
  userProperties?: Record<string, any>;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}