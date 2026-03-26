import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Logger,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WaitlistEntry, WaitlistStatus, WaitlistAnalytics } from '../entities';
import { EventsService } from '../../events/events.service';
import { UsersService } from '../../users/users.service';
import { SeatService } from '../../booking/services/seat.service';
import { TaskQueueService } from '../../task-queue/services/task-queue.service';
import { nanoid } from 'nanoid';
import { User, UserRole } from '../../users/entities/user.entity';

@Injectable()
export class WaitlistService {
    private readonly logger = new Logger(WaitlistService.name);

    constructor(
        @InjectRepository(WaitlistEntry)
        private readonly entryRepository: Repository<WaitlistEntry>,
        @InjectRepository(WaitlistAnalytics)
        private readonly analyticsRepository: Repository<WaitlistAnalytics>,
        private readonly eventsService: EventsService,
        private readonly usersService: UsersService,
        @Inject(forwardRef(() => SeatService))
        private readonly seatService: SeatService,
        private readonly taskQueueService: TaskQueueService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Scheduled task to trigger waitlist expiry scan every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async scheduleExpiryScan(): Promise<void> {
        this.logger.log('Enqueuing waitlist expiry scan job...');
        await this.taskQueueService.enqueueWaitlistExpiryScan();
    }

    /**
     * Register a user for an event waitlist
     */
    async register(eventId: string, userId: string, referralCode?: string): Promise<WaitlistEntry> {
        // 1. Validate event existence
        const event = await this.eventsService.findOne(eventId);
        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // 2. Check if event is sold out
        const availability = await this.seatService.getAvailability(eventId);
        if (availability.available > 0) {
            throw new BadRequestException('Event is not sold out yet. Tickets are still available.');
        }

        // 3. Prevent duplicate registrations
        const existingEntry = await this.entryRepository.findOne({
            where: { eventId, userId, status: WaitlistStatus.PENDING },
        });
        if (existingEntry) {
            throw new ConflictException('User is already on the waitlist for this event.');
        }

        // 4. Handle referral code
        let referredBy: string | null = null;
        if (referralCode) {
            const referrerEntry = await this.entryRepository.findOne({
                where: { eventId, referralCode, status: In([WaitlistStatus.PENDING, WaitlistStatus.INVITED, WaitlistStatus.CONVERTED]) },
            });
            if (referrerEntry) {
                referredBy = referrerEntry.userId;
            }
        }

        // 5. Calculate initial priority score
        const user = await this.usersService.findById(userId);
        const priorityScore = this.calculateInitialScore(user, referredBy !== null);

        // 6. Create entry
        const ttl = this.configService.get<number>('WAITLIST_ENTRY_TTL_DAYS', 30);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + ttl);

        const entry = this.entryRepository.create({
            id: nanoid(),
            eventId,
            userId,
            priorityScore,
            referralCode: nanoid(8),
            referredBy: referredBy || undefined,
            status: WaitlistStatus.PENDING,
            expiresAt,
        });

        const savedEntry = await this.entryRepository.save(entry);

        // 7. If referred, update referrer's score
        if (referredBy) {
            await this.updateReferrerScore(eventId, referredBy);
        }

        // 8. Update analytics
        await this.updateAnalytics(eventId, 'totalWaitlisted');

        // 9. Enqueue position update notification for the user
        await this.taskQueueService.enqueueNotification({
            userId,
            type: 'waitlist_position_update',
            message: `You've been added to the waitlist for ${event.name}.`,
        });

        return savedEntry;
    }

    /**
     * Calculate initial priority score
     */
    private calculateInitialScore(user: User, hasReferral: boolean): number {
        // Base score is negative timestamp (earlier = higher)
        let score = -Date.now();

        // Referral boost (multiplier)
        if (hasReferral) {
            const boost = this.configService.get<number>('WAITLIST_REFERRAL_BOOST', 1.2);
            score = score * (1 / boost); // Lower negative value = higher score
        }

        // User role boost (Admins and Organizers get a small boost)
        if (user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.ORGANIZER)) {
            const roleBoost = this.configService.get<number>('WAITLIST_ROLE_BOOST', 1.1);
            score = score * (1 / roleBoost);
        }

        return score;
    }

    /**
     * Update referrer score after a successful referral
     */
    private async updateReferrerScore(eventId: string, userId: string): Promise<void> {
        const entry = await this.entryRepository.findOne({
            where: { eventId, userId, status: WaitlistStatus.PENDING },
        });

        if (entry) {
            const boost = this.configService.get<number>('WAITLIST_REFERRAL_CONTRIBUTION_BOOST', 1.05);
            entry.priorityScore = entry.priorityScore * (1 / boost);
            await this.entryRepository.save(entry);
        }
    }

    /**
     * Update waitlist analytics
     */
    private async updateAnalytics(eventId: string, field: keyof WaitlistAnalytics): Promise<void> {
        let analytics = await this.analyticsRepository.findOne({ where: { eventId } });
        if (!analytics) {
            analytics = this.analyticsRepository.create({
                eventId,
                snapshotAt: new Date(),
            });
        }

        if (typeof analytics[field] === 'number') {
            (analytics[field] as number)++;
        }

        analytics.snapshotAt = new Date();
        await this.analyticsRepository.save(analytics);
    }

    /**
     * Fetch and invite next users in queue
     */
    async fetchNextInvitees(eventId: string, count: number): Promise<WaitlistEntry[]> {
        const entries = await this.entryRepository.find({
            where: { eventId, status: WaitlistStatus.PENDING },
            order: { priorityScore: 'DESC', createdAt: 'ASC' },
            take: count,
        });

        if (entries.length === 0) return [];

        const inviteWindowMinutes = this.configService.get<number>('WAITLIST_INVITE_WINDOW_MINUTES', 60);
        const inviteExpiresAt = new Date();
        inviteExpiresAt.setMinutes(inviteExpiresAt.getMinutes() + inviteWindowMinutes);

        for (const entry of entries) {
            entry.status = WaitlistStatus.INVITED;
            entry.inviteSentAt = new Date();
            entry.inviteExpiresAt = inviteExpiresAt;
            await this.entryRepository.save(entry);

            // Enqueue invite job
            await this.taskQueueService.enqueueNotification({
                userId: entry.userId,
                type: 'waitlist_invite',
                message: 'A ticket has become available! You have a limited time to claim it.',
                metadata: { eventId, inviteExpiresAt },
            });

            // Update analytics
            await this.updateAnalytics(eventId, 'totalInvited');
        }

        return entries;
    }

    /**
     * Trigger next invitees when tickets become available
     */
    async processReleasedTickets(eventId: string, releasedCount: number): Promise<void> {
        this.logger.log(`Tickets released for event ${eventId}: ${releasedCount}. Checking waitlist...`);
        await this.fetchNextInvitees(eventId, releasedCount);
    }

    /**
     * Get queue position for a user
     */
    async getQueuePosition(eventId: string, userId: string): Promise<number> {
        const entry = await this.entryRepository.findOne({
            where: { eventId, userId, status: WaitlistStatus.PENDING },
        });

        if (!entry) return -1;

        const count = await this.entryRepository.count({
            where: {
                eventId,
                status: WaitlistStatus.PENDING,
                priorityScore: MoreThan(entry.priorityScore),
            },
        });

        return count + 1;
    }

    /**
     * Handle successful booking conversion
     */
    async handleSuccessfulBooking(eventId: string, userId: string): Promise<void> {
        const entry = await this.entryRepository.findOne({
            where: { eventId, userId, status: In([WaitlistStatus.PENDING, WaitlistStatus.INVITED]) },
        });

        if (entry) {
            entry.status = WaitlistStatus.CONVERTED;
            await this.entryRepository.save(entry);
            await this.updateAnalytics(eventId, 'totalConverted');
            this.logger.log(`Waitlist entry for user ${userId} on event ${eventId} converted to booking.`);
        }
    }

    /**
     * Get waitlist analytics for an event
     */
    async getEventAnalytics(eventId: string): Promise<WaitlistAnalytics | null> {
        return await this.analyticsRepository.findOne({ where: { eventId } });
    }

    /**
     * Manually send invites
     */
    async manualInvite(eventId: string, userId?: string, count?: number): Promise<WaitlistEntry[]> {
        if (userId) {
            const entry = await this.entryRepository.findOne({
                where: { eventId, userId, status: WaitlistStatus.PENDING },
            });
            if (!entry) throw new NotFoundException('Pending waitlist entry not found for user.');

            const inviteWindowMinutes = this.configService.get<number>('WAITLIST_INVITE_WINDOW_MINUTES', 60);
            const inviteExpiresAt = new Date();
            inviteExpiresAt.setMinutes(inviteExpiresAt.getMinutes() + inviteWindowMinutes);

            entry.status = WaitlistStatus.INVITED;
            entry.inviteSentAt = new Date();
            entry.inviteExpiresAt = inviteExpiresAt;
            await this.entryRepository.save(entry);

            // Enqueue invite job
            await this.taskQueueService.enqueueNotification({
                userId,
                type: 'waitlist_invite',
                message: 'A ticket has become available! You have a limited time to claim it.',
                metadata: { eventId, inviteExpiresAt },
            });

            await this.updateAnalytics(eventId, 'totalInvited');
            return [entry];
        }

        return await this.fetchNextInvitees(eventId, count || 1);
    }
}
