import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { TaskQueueService } from '../services/task-queue.service';
import { NotificationsGateway } from '../../notifications/gateway/notifications.gateway';

@Processor('waitlist:notifications')
export class WaitlistNotificationProcessor extends WorkerHost {
    private readonly logger = new Logger(WaitlistNotificationProcessor.name);

    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly taskQueueService: TaskQueueService,
        private readonly notificationsGateway: NotificationsGateway,
    ) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing waitlist notification job: ${job.id} (type: ${job.data.type})`);

        const { userId, type, message, metadata } = job.data;

        try {
            await this.notificationsService.createAndSendNotification({
                userId,
                type: NotificationType.IN_APP,
                category: NotificationCategory.INVITATION,
                title: 'Waitlist Update',
                message,
                metadata,
                sendImmediately: true,
            });
            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to process waitlist notification: ${error.message}`);
            throw error;
        }
    }

    @OnWorkerEvent('failed')
    async onJobFailed(job: Job, error: Error) {
        const maxAttempts = job.opts.attempts ?? 1;

        if (job.attemptsMade >= maxAttempts) {
            this.logger.warn(`Job ${job.id} has failed permanently. Routing to DLQ and notifying admin.`);
            
            // 1. Move to Dead Letter Queue
            await this.taskQueueService.moveToDeadLetterQueue(job, error.message);

            // 2. Emit WebSocket event to admin room
            if (this.notificationsGateway?.server) {
                this.notificationsGateway.server.to('admin_room').emit('admin_job_failed_permanently', {
                    queueName: job.queueName,
                    jobId: job.id,
                    errorMessage: error.message,
                    failedAt: new Date(),
                });
            }
        }
    }
}

