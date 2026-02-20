import { Injectable } from '@nestjs/common';
import { Review } from '../reviews/entities/review.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class NotificationsService {
  /**
   * Notify event organizer of new review
   */
  async sendReviewNotification(review: Review, event: Event): Promise<void> {
    // TODO: Implement real notification (email/WebSocket, etc.)
    // For now, just log (can be extended with email service or WebSocket).
    console.log(`Notification: New review for event "${event.name}" by ${review.userId}`);
  }

  /**
   * Notify moderators of flagged content
   */
  async sendModerationNotification(review: Review, event: Event): Promise<void> {
    // TODO: Implement email/notification system
    console.log(`Moderation Alert: Review ${review.id} flagged for event "${event.name}"`);
  }

  /**
   * Notify moderators when report threshold is reached
   */
  async sendReportNotification(review: Review, event: Event, reportCount: number): Promise<void> {
    const threshold = 3; // Configurable threshold

    if (reportCount >= threshold) {
      // TODO: Implement notification system
      console.log(
        `Report Alert: Review ${review.id} has ${reportCount} reports (threshold: ${threshold})`,
      );
    }
  }

  /**
   * Notify user when their review is moderated
   */
  async sendModerationResultNotification(
    review: Review,
    status: string,
    reason?: string,
  ): Promise<void> {
    // TODO: Implement notification
    console.log(
      `Review Status Update: Review ${review.id} status changed to ${status}${reason ? ` - ${reason}` : ''}`,
    );
  }
}
