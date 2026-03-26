import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WaitlistService } from '../../waitlist/services/waitlist.service';

@Processor('waitlist:invite')
export class WaitlistInviteProcessor extends WorkerHost {
    private readonly logger = new Logger(WaitlistInviteProcessor.name);

    constructor(private readonly waitlistService: WaitlistService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        const { eventId, count } = job.data;
        this.logger.log(`Processing waitlist invite job for event ${eventId}, count: ${count}`);

        try {
            const invited = await this.waitlistService.fetchNextInvitees(eventId, count);
            return { invitedCount: invited.length };
        } catch (error) {
            this.logger.error(`Failed to process waitlist invite: ${error.message}`);
            throw error;
        }
    }
}
