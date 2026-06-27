import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WaitlistService } from '../../waitlist/services/waitlist.service';
import { TaskQueueService } from '../services/task-queue.service';

@Processor('waitlist:invite')
export class WaitlistInviteProcessor extends WorkerHost {
    private readonly logger = new Logger(WaitlistInviteProcessor.name);

    constructor(
        private readonly waitlistService: WaitlistService,
        private readonly taskQueueService: TaskQueueService,
    ) {
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

    @OnWorkerEvent('failed')
    async onJobFailed(job: Job, error: Error) {
        const maxAttempts = job.opts.attempts ?? 1;

        if (job.attemptsMade >= maxAttempts) {
            this.logger.warn(`Waitlist Invite Job ${job.id} failed permanently. Routing to DLQ.`);
            await this.taskQueueService.moveToDeadLetterQueue(job, error.message);
        }
    }
}
