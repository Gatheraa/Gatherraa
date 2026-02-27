import { PartialType } from '@nestjs/swagger';
import { CreateWebhookDto } from './create-webhook.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWebhookDto extends PartialType(CreateWebhookDto) {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
