import {
  IsEnum,
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { WebhookEventType } from '../constants/webhook.constants';

export class CreateWebhookDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsUrl()
  url: string;

  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events: WebhookEventType[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEventType, { each: true })
  events?: WebhookEventType[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
