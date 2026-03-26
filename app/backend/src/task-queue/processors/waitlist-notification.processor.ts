import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';

@Processor('waitlist:notifications')
export class WaitlistNotificationProcessor extends WorkerHost {
    private readonly logger = new Logger(WaitlistNotificationProcessor.name);

    constructor(private readonly notificationsService: NotificationsService) {
        super();
    }

    async process(job: Job<any, any, string>): Promise<any> {
        this.logger.log(`Processing waitlist notification job: ${job.id} (type: ${job.data.type})`);

        const { userId, type, message, metadata } = job.data;

        try {
            await this.notificationsService.createAndSendNotification({
                userId,
                type: NotificationType.IN_APP, // Default to in-app for these updates, or map from 'type'
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
}
