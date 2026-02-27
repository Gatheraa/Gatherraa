import { IsOptional, IsIn, IsDateString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ALL_WEBHOOK_EVENT_TYPES, WebhookEventType } from '../constants/webhook-events.constant';
import { Type } from 'class-transformer';

export class TestWebhookDto {
    @ApiPropertyOptional({ enum: ALL_WEBHOOK_EVENT_TYPES })
    @IsOptional()
    @IsIn(ALL_WEBHOOK_EVENT_TYPES)
    eventType?: WebhookEventType;
}

export class WebhookAnalyticsQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({ enum: ALL_WEBHOOK_EVENT_TYPES })
    @IsOptional()
    @IsIn(ALL_WEBHOOK_EVENT_TYPES)
    eventType?: WebhookEventType;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 20;
}
