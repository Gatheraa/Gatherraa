import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { WaitlistEntry, WaitlistStatus } from '../../waitlist/entities';
import { WaitlistService } from '../../waitlist/services/waitlist.service';

@Processor('waitlist:expiry')
export class WaitlistExpiryProcessor extends WorkerHost {
    private readonly logger = new Logger(WaitlistExpiryProcessor.name);

    constructor(
        @InjectRepository(WaitlistEntry)
        private readonly entryRepository: Repository<WaitlistEntry>,
        private readonly waitlistService: WaitlistService,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing waitlist expiry job: ${job.id}`);

        // If it's a cron job, scan for all expired entries
        if (job.name === 'scan-expiries') {
            return await this.scanAndExpire();
        }

        // Otherwise, handle a specific entry expiry
        const { entryId } = job.data;
        if (entryId) {
            return await this.expireEntry(entryId);
        }
    }

    private async scanAndExpire(): Promise<any> {
        const now = new Date();

        // 1. Expire un-invited entries that reached global TTL
        const expiredEntries = await this.entryRepository.find({
            where: {
                status: WaitlistStatus.PENDING,
                expiresAt: LessThan(now),
            },
        });

        for (const entry of expiredEntries) {
            entry.status = WaitlistStatus.EXPIRED;
            await this.entryRepository.save(entry);
            this.logger.log(`Expired waitlist entry ${entry.id} due to global TTL.`);
        }

        // 2. Expire invitations that passed window
        const expiredInvites = await this.entryRepository.find({
            where: {
                status: WaitlistStatus.INVITED,
                inviteExpiresAt: LessThan(now),
            },
        });

        for (const entry of expiredInvites) {
            const previousStatus = entry.status;
            entry.status = WaitlistStatus.EXPIRED;
            await this.entryRepository.save(entry);
            this.logger.log(`Expired invitation for entry ${entry.id}. Releasing ticket...`);

            // Trigger next person in queue
            if (previousStatus === WaitlistStatus.INVITED) {
                await this.waitlistService.processReleasedTickets(entry.eventId, 1);
            }
        }

        return {
            expiredEntries: expiredEntries.length,
            expiredInvites: expiredInvites.length,
        };
    }

    private async expireEntry(entryId: string): Promise<any> {
        const entry = await this.entryRepository.findOne({ where: { id: entryId } });
        if (!entry || entry.status === WaitlistStatus.EXPIRED) return;

        const previousStatus = entry.status;
        entry.status = WaitlistStatus.EXPIRED;
        await this.entryRepository.save(entry);

        if (previousStatus === WaitlistStatus.INVITED) {
            await this.waitlistService.processReleasedTickets(entry.eventId, 1);
        }

        return { success: true };
    }
}
