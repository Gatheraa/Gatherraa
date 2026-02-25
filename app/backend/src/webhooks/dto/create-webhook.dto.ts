import {
    IsString,
    IsNotEmpty,
    IsUrl,
    IsArray,
    ArrayMinSize,
    IsIn,
    IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ALL_WEBHOOK_EVENT_TYPES,
    WebhookEventType,
} from '../constants/webhook-events.constant';

export class CreateWebhookDto {
    @ApiProperty({ example: 'My Webhook' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'https://example.com/webhook' })
    @IsUrl({ require_tld: false })
    url: string;

    @ApiProperty({ enum: ALL_WEBHOOK_EVENT_TYPES, isArray: true })
    @IsArray()
    @ArrayMinSize(1)
    @IsIn(ALL_WEBHOOK_EVENT_TYPES, { each: true })
    events: WebhookEventType[];

    @ApiPropertyOptional({ enum: ['v1', 'v2'], default: 'v1' })
    @IsOptional()
    @IsIn(['v1', 'v2'])
    version?: string;
}
