import { IsString, IsArray, IsOptional, IsBoolean, IsJSON, IsEnum } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(['event_reminder', 'ticket_sale', 'review', 'system_alert', 'marketing', 'invitation', 'comment', 'follower'])
  category: string;

  @IsString()
  emailSubject: string;

  @IsString()
  emailTemplate: string;

  @IsString()
  pushTitle: string;

  @IsString()
  pushMessage: string;

  @IsString()
  inAppTitle: string;

  @IsString()
  inAppMessage: string;

  @IsOptional()
  @IsString()
  smsTemplate?: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsJSON()
  defaultData?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailTemplate?: string;

  @IsOptional()
  @IsString()
  pushTitle?: string;

  @IsOptional()
  @IsString()
  pushMessage?: string;

  @IsOptional()
  @IsString()
  inAppTitle?: string;

  @IsOptional()
  @IsString()
  inAppMessage?: string;

  @IsOptional()
  @IsString()
  smsTemplate?: string;

  @IsOptional()
  @IsArray()
  variables?: string[];

  @IsOptional()
  @IsJSON()
  defaultData?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class NotificationTemplateResponseDto {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  emailSubject: string;
  emailTemplate: string;
  pushTitle: string;
  pushMessage: string;
  inAppTitle: string;
  inAppMessage: string;
  smsTemplate?: string;
  variables: string[];
  defaultData?: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
