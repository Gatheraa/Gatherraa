import { ApiProperty } from '@nestjs/swagger';

export class WebhookResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    url: string;

    @ApiProperty({ isArray: true })
    events: string[];

    @ApiProperty()
    version: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    ownerId: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class WebhookSecretResponseDto extends WebhookResponseDto {
    @ApiProperty({ description: 'HMAC secret key. Only returned once upon creation.' })
    secret: string;
}
