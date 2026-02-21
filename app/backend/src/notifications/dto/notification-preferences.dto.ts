import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested, IsArray, IsPhoneNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ChannelPreferencesDto {
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  sms?: boolean;
}

export class CategoryPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  eventReminder?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  ticketSale?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  review?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  systemAlert?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  marketing?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  invitation?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  comment?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  follower?: ChannelPreferencesDto;
}

export class QuietHoursDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  startTime: string; // HH:mm

  @IsString()
  endTime: string; // HH:mm

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPreferencesDto)
  defaultChannels?: ChannelPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferencesDto)
  categoryPreferences?: CategoryPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @IsOptional()
  @IsEnum(['immediate', 'daily_digest', 'weekly_digest'])
  frequency?: 'immediate' | 'daily_digest' | 'weekly_digest';

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsString()
  fcmToken?: string;

  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('ZZ')
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  unsubscribedCategories?: string[];

  @IsOptional()
  @IsBoolean()
  unsubscribedFromAll?: boolean;
}

export class NotificationPreferencesResponseDto {
  id: string;
  userId: string;
  notificationsEnabled: boolean;
  defaultChannels: ChannelPreferencesDto;
  categoryPreferences: CategoryPreferencesDto;
  quietHours?: QuietHoursDto;
  frequency: string;
  pushEnabled: boolean;
  primaryEmail?: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneVerified: boolean;
  language: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}
