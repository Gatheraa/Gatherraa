import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { WaitlistService } from './services/waitlist.service';
import { RegisterWaitlistDto, ManualInviteDto, WaitlistResponseDto } from './dto/waitlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('waitlist')
export class WaitlistController {
    constructor(private readonly waitlistService: WaitlistService) { }

    /**
     * Register for an event waitlist
     */
    @Post('register')
    @UseGuards(JwtAuthGuard)
    async register(
        @Body() dto: RegisterWaitlistDto,
        @CurrentUser() user: User,
    ): Promise<Partial<WaitlistResponseDto>> {
        const entry = await this.waitlistService.register(dto.eventId, user.id, dto.referralCode);
        const queuePosition = await this.waitlistService.getQueuePosition(dto.eventId, user.id);

        return {
            id: entry.id,
            eventId: entry.eventId,
            userId: entry.userId,
            priorityScore: entry.priorityScore,
            queuePosition,
            status: entry.status,
            expiresAt: entry.expiresAt,
            createdAt: entry.createdAt,
        };
    }

    /**
     * Get queue position for the current user
     */
    @Get('position/:eventId')
    @UseGuards(JwtAuthGuard)
    async getPosition(
        @Param('eventId') eventId: string,
        @CurrentUser() user: User,
    ): Promise<{ queuePosition: number }> {
        const queuePosition = await this.waitlistService.getQueuePosition(eventId, user.id);
        if (queuePosition === -1) {
            throw new NotFoundException('User is not on the waitlist for this event.');
        }
        return { queuePosition };
    }

    /**
     * Manually send invites (Admins/Organizers only)
     */
    @Post('invite/manual')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
    async manualInvite(
        @Body() dto: ManualInviteDto,
        @CurrentUser() user: User,
    ): Promise<{ invited: number }> {
        const entries = await this.waitlistService.manualInvite(dto.eventId, dto.userId, dto.count);
        return { invited: entries.length };
    }

    /**
     * Get waitlist analytics for an event (Admins/Organizers only)
     */
    @Get('analytics/:eventId')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
    async getAnalytics(
        @Param('eventId') eventId: string,
    ) {
        const analytics = await this.waitlistService.getEventAnalytics(eventId);
        if (!analytics) {
            throw new NotFoundException('Analytics not found for this event.');
        }
        return analytics;
    }
}
