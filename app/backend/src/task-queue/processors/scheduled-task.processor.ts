// Scheduled Task Job Processor
// Handles recurring and scheduled tasks

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TaskQueueService } from '../services/task-queue.service';
import { SessionsService } from '../../sessions/sessions.service';
import { ReportService } from '../../analytics/services/report.service';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../../notifications/entities/notification.entity';
import { RetentionService } from '../../audit/services/retention.service';
import { CacheWarmupService } from '../../cache/services/cache-warmup.service';
import { BlockchainAuditService } from '../../audit/services/blockchain-audit.service';
import { AdvancedAnalyticsService } from '../../analytics/services/advanced-analytics.service';

export interface ScheduledTaskJobData {
  taskName: string;
  payload: any;
  executedAt?: string;
}

/**
 * Processor for scheduled tasks
 * Handles recurring jobs and cron-based task execution
 */
@Processor('scheduled-tasks')
@Injectable()
export class ScheduledTaskProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledTaskProcessor.name);

  private taskHandlers: Map<string, (payload: any) => Promise<any>> = new Map();

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly reportService: ReportService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificationsService: NotificationsService,
    private readonly retentionService: RetentionService,
    private readonly cacheWarmupService: CacheWarmupService,
    private readonly blockchainAuditService: BlockchainAuditService,
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly taskQueueService: TaskQueueService,
  ) {
    super();
    this.registerTaskHandlers();
  }

  /**
   * Register available task handlers
   */
  private registerTaskHandlers() {
    // Example tasks - register your actual scheduled tasks here
    this.registerTask('cleanup-expired-sessions', this.cleanupExpiredSessions);
    this.registerTask('generate-daily-reports', this.generateDailyReports);
    this.registerTask('sync-blockchain-state', this.syncBlockchainState);
    this.registerTask('archive-old-logs', this.archiveOldLogs);
    this.registerTask(
      'send-reminder-notifications',
      this.sendReminderNotifications,
    );
    this.registerTask('refresh-cache', this.refreshCache);
    this.registerTask('generate-analytics', this.generateAnalytics);
  }

  /**
   * Register a task handler
   */
  private registerTask(
    taskName: string,
    handler: (payload: any) => Promise<any>,
  ) {
    this.taskHandlers.set(taskName, handler.bind(this));
  }

  /**
   * Process scheduled task
   */
  async process(job: Job<ScheduledTaskJobData>) {
    const jobId = job.id;
    const { taskName, payload } = job.data;

    try {
      this.logger.log(`Processing scheduled task ${jobId}: ${taskName}`);

      await job.updateProgress(10);

      // Get task handler
      const handler = this.taskHandlers.get(taskName);
      if (!handler) {
        throw new Error(`Unknown task: ${taskName}`);
      }

      await job.updateProgress(30);

      // Execute task
      const result = await handler(payload);

      await job.updateProgress(100);

      this.logger.log(
        `Scheduled task ${jobId} (${taskName}) completed successfully`,
      );

      return {
        success: true,
        taskName,
        result,
        executedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled task ${jobId}: ${error.message}`,
        error.stack,
      );

      throw {
        message: error.message,
        taskName,
        originalError: error,
      };
    }
  }

  /**
   * Clean up expired sessions task
   */
  private async cleanupExpiredSessions(payload: any): Promise<any> {
    this.logger.log('Starting cleanup of expired sessions');

    const cleaned = await this.sessionsService.cleanupExpiredSessions();

    this.logger.log(`Cleaned up ${cleaned} expired sessions`);

    return {
      action: 'cleanup-expired-sessions',
      cleanedCount: cleaned,
      timestamp: new Date(),
    };
  }

  /**
   * Generate daily reports task
   */
  private async generateDailyReports(payload: any): Promise<any> {
    this.logger.log('Starting daily report generation');

    await this.reportService.processScheduledReports();
    const reports = await this.reportService.getUserReports(payload?.userId || 'system');

    this.logger.log(`Generated ${reports.length} daily reports`);

    return {
      action: 'generate-daily-reports',
      reportsGenerated: reports.length,
      timestamp: new Date(),
    };
  }

  /**
   * Sync blockchain state task
   */
  private async syncBlockchainState(payload: any): Promise<any> {
    this.logger.log('Starting blockchain state sync');

    const batchHash = payload?.batchHash || 'default-batch';
    const txHash = await this.blockchainAuditService.anchorBatch(batchHash);
    const synced = txHash ? 1 : 0;

    this.logger.log(`Synced ${synced} blockchain events. TxHash: ${txHash || 'none'}`);

    return {
      action: 'sync-blockchain-state',
      eventsSynced: synced,
      txHash,
      timestamp: new Date(),
    };
  }

  /**
   * Archive old logs task
   */
  private async archiveOldLogs(payload: any): Promise<any> {
    this.logger.log('Starting log archival');

    await this.retentionService.handleRetention();
    const archived = payload?.archivedCount || 0;

    this.logger.log(`Archived ${archived} log entries`);

    return {
      action: 'archive-old-logs',
      archivedCount: archived,
      timestamp: new Date(),
    };
  }

  /**
   * Send reminder notifications task
   */
  private async sendReminderNotifications(payload: any): Promise<any> {
    this.logger.log('Starting reminder notification sending');

    let sent = 0;
    const userIds = payload?.userIds || [];

    if (userIds.length > 0) {
      await this.notificationsService.sendBulkNotifications({
        userIds,
        types: [NotificationType.EMAIL],
        category: NotificationCategory.EVENT_REMINDER,
        title: payload?.title || 'Event Reminder',
        message: payload?.message || 'You have an upcoming event.',
        data: payload?.data,
      });
      sent = userIds.length;
    } else {
      this.logger.warn('No userIds provided for reminder notifications');
    }

    this.logger.log(`Sent ${sent} reminder notifications`);

    return {
      action: 'send-reminder-notifications',
      sentCount: sent,
      timestamp: new Date(),
    };
  }

  /**
   * Refresh cache task
   */
  private async refreshCache(payload: any): Promise<any> {
    this.logger.log('Starting cache refresh');

    await this.cacheWarmupService.warmupPopularContent();
    const stats = this.cacheWarmupService.getWarmupStats();
    const refreshed = stats.successfulWarmed;

    this.logger.log(`Refreshed ${refreshed} cache entries`);

    return {
      action: 'refresh-cache',
      refreshedCount: refreshed,
      stats,
      timestamp: new Date(),
    };
  }

  /**
   * Generate analytics task
   */
  private async generateAnalytics(payload: any): Promise<any> {
    this.logger.log('Starting analytics generation');

    const timePeriod = payload?.timePeriod || 'last_7_days';
    const metrics = await this.advancedAnalyticsService.getDashboardKPIs(timePeriod);

    this.logger.log('Analytics generation completed');

    return {
      action: 'generate-analytics',
      metrics,
      timestamp: new Date(),
    };
  }

  /**
   * Handle job failures and route to DLQ if max attempts reached
   */
  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.warn(
        `Scheduled Task Job ${job.id} failed permanently after ${job.attemptsMade} attempts. Routing to DLQ.`,
      );
      await this.taskQueueService.moveToDeadLetterQueue(job, error.message);
    }
  }
}
