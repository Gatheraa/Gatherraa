import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterWaitlistDto {
    @IsUUID()
    @ApiProperty({ description: 'The ID of the event to join the waitlist for' })
    eventId: string;

    @IsString()
    @IsOptional()
    @ApiProperty({ description: 'Optional referral code used for registration', required: false })
    referralCode?: string;
}

export class ManualInviteDto {
    @IsUUID()
    @ApiProperty({ description: 'The ID of the event' })
    eventId: string;

    @IsUUID()
    @IsOptional()
    @ApiProperty({ description: 'Specific user ID to invite', required: false })
    userId?: string;

    @IsNumber()
    @IsOptional()
    @Min(1)
    @ApiProperty({ description: 'Number of next-in-queue entries to invite', required: false })
    count?: number;
}

export class WaitlistResponseDto {
    id: string;
    eventId: string;
    userId: string;
    priorityScore: number;
    queuePosition: number;
    status: string;
    expiresAt: Date;
    createdAt: Date;
}
