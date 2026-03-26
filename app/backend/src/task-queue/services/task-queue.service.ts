// Task Queue Service
// Main service for enqueuing and managing background jobs

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import { v4 as uuid } from 'uuid';

export interface JobData {
  [key: string]: any;
}

export interface JobOptions extends JobsOptions {
  priority?: number;
  deduplicationKey?: string;
}

export enum JobType {
  EMAIL = 'email',
  IMAGE_PROCESSING = 'image-processing',
  BLOCKCHAIN_EVENT = 'blockchain-event',
  SCHEDULED_TASK = 'scheduled-task',
  NOTIFICATION = 'notification',
  ANALYTICS = 'analytics',
  WAITLIST_NOTIFICATION = 'waitlist-notification',
  WAITLIST_EXPIRY = 'waitlist-expiry',
  WAITLIST_INVITE = 'waitlist-invite',
}

export enum QueueName {
  EMAIL = 'email',
  IMAGE_PROCESSING = 'image-processing',
  BLOCKCHAIN_EVENTS = 'blockchain-events',
  SCHEDULED_TASKS = 'scheduled-tasks',
  NOTIFICATIONS = 'notifications',
  ANALYTICS = 'analytics',
  DEAD_LETTER = 'dead-letter',
  WAITLIST_NOTIFICATIONS = 'waitlist:notifications',
  WAITLIST_EXPIRY = 'waitlist:expiry',
  WAITLIST_INVITE = 'waitlist:invite',
}

/**
 * Service for managing distributed task queue operations
 * Handles job enqueuing, scheduling, and lifecycle management
 */
@Injectable()
export class TaskQueueService {
  private readonly logger = new Logger(TaskQueueService.name);

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('image-processing') private imageQueue: Queue,
    @InjectQueue('blockchain-events') private blockchainQueue: Queue,
    @InjectQueue('scheduled-tasks') private scheduledQueue: Queue,
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
    @InjectQueue('dead-letter') private deadLetterQueue: Queue,
    @InjectQueue('waitlist:notifications') private waitlistNotifQueue: Queue,
    @InjectQueue('waitlist:expiry') private waitlistExpiryQueue: Queue,
    @InjectQueue('waitlist:invite') private waitlistInviteQueue: Queue,
  ) { }

  /**
   * Get queue by name
   */
  getQueue(queueName: QueueName): Queue {
    switch (queueName) {
      case QueueName.EMAIL:
        return this.emailQueue;
      case QueueName.IMAGE_PROCESSING:
        return this.imageQueue;
      case QueueName.BLOCKCHAIN_EVENTS:
        return this.blockchainQueue;
      case QueueName.SCHEDULED_TASKS:
        return this.scheduledQueue;
      case QueueName.NOTIFICATIONS:
        return this.notificationQueue;
      case QueueName.ANALYTICS:
        return this.analyticsQueue;
      case QueueName.DEAD_LETTER:
        return this.deadLetterQueue;
      case QueueName.WAITLIST_NOTIFICATIONS:
        return this.waitlistNotifQueue;
      case QueueName.WAITLIST_EXPIRY:
        return this.waitlistExpiryQueue;
      case QueueName.WAITLIST_INVITE:
        return this.waitlistInviteQueue;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }
  }

  /**
   * Add a job to the email queue
   * @param data Job data (to, subject, template, etc.)
   * @param options Job options (priority, delay, etc.)
   * @returns Job instance
   */
  async enqueueEmail(
    data: { to: string; subject: string; template: string; context?: any },
    options?: JobOptions,
  ): Promise<Job> {
    const jobId = options?.deduplicationKey || `email-${uuid()}`;

    this.logger.log(
      `Enqueuing email job: ${jobId}`,
      { to: data.to, subject: data.subject },
    );

    try {
      const job = await this.emailQueue.add('send-email', data, {
        jobId,
        attempts: options?.attempts || 3,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        priority: options?.priority || 0,
        delay: options?.delay,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a job to the image processing queue
   * @param data Job data (url, transformations, format, etc.)
   * @param options Job options
   * @returns Job instance
   */
  async enqueueImageProcessing(
    data: {
      url: string;
      transformations: any[];
      outputFormat?: string;
      quality?: number;
    },
    options?: JobOptions,
  ): Promise<Job> {
    const jobId = options?.deduplicationKey || `image-${uuid()}`;

    this.logger.log(`Enqueuing image processing job: ${jobId}`, {
      url: data.url,
      transformations: data.transformations,
    });

    try {
      const job = await this.imageQueue.add('process-image', data, {
        jobId,
        attempts: options?.attempts || 3,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        priority: options?.priority || 0,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue image processing: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Add a job to the blockchain events queue
   * @param data Job data (contractAddress, eventName, parameters, etc.)
   * @param options Job options
   * @returns Job instance
   */
  async enqueueBlockchainEvent(
    data: {
      contractAddress: string;
      eventName: string;
      parameters: any;
      networkId?: string;
    },
    options?: JobOptions,
  ): Promise<Job> {
    const jobId =
      options?.deduplicationKey ||
      `blockchain-${data.contractAddress}-${uuid()}`;

    this.logger.log(
      `Enqueuing blockchain event job: ${jobId}`,
      { event: data.eventName },
    );

    try {
      const job = await this.blockchainQueue.add('blockchain-event', data, {
        jobId,
        attempts: options?.attempts || 5,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 3000,
        },
        priority: options?.priority || 1,
        removeOnComplete: { age: 7200 },
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue blockchain event: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Add a scheduled task to the queue
   * @param data Job data (taskName, payload, interval, etc.)
   * @param cronPattern Cron pattern for scheduling
   * @param options Job options
   * @returns Job instance
   */
  async enqueueScheduledTask(
    data: {
      taskName: string;
      payload: any;
    },
    cronPattern: string,
    options?: JobOptions,
  ): Promise<Job> {
    const jobId = options?.deduplicationKey || `scheduled-${uuid()}`;

    this.logger.log(
      `Enqueuing scheduled task: ${jobId}`,
      { taskName: data.taskName, cron: cronPattern },
    );

    try {
      const job = await this.scheduledQueue.add(data.taskName, data, {
        jobId,
        repeat: {
          pattern: cronPattern,
          tz: 'UTC',
        },
        attempts: options?.attempts || 2,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(
        `Failed to enqueue scheduled task: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Add a notification job
   * @param data Job data (userId, type, message, etc.)
   * @param options Job options
   * @returns Job instance
   */
  async enqueueNotification(
    data: {
      userId: string;
      type: string;
      message: string;
      metadata?: any;
    },
    options?: JobOptions,
  ): Promise<Job> {
    const jobId = options?.deduplicationKey || `notif-${uuid()}`;

    try {
      const job = await this.notificationQueue.add(data.type, data, {
        jobId,
        attempts: options?.attempts || 2,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 2000,
        },
        priority: options?.priority || 5,
        removeOnComplete: { age: 3600 },
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add an analytics job
   * @param data Job data (event, userId, properties, etc.)
   * @param options Job options
   * @returns Job instance
   */
  async enqueueAnalytics(
    data: {
      event: string;
      userId?: string;
      properties: any;
      timestamp?: number;
    },
    options?: JobOptions,
  ): Promise<Job> {
    const jobId = options?.deduplicationKey || `analytics-${uuid()}`;

    try {
      const job = await this.analyticsQueue.add(data.event, data, {
        jobId,
        attempts: options?.attempts || 2,
        backoff: options?.backoff || {
          type: 'exponential',
          delay: 1000,
        },
        priority: options?.priority || -10, // Low priority for analytics
        removeOnComplete: { age: 7200 },
        removeOnFail: false,
      });
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Move a job to dead letter queue
   * @param job Job to move
   * @param reason Reason for moving to DLQ
   */
  async moveToDeadLetterQueue(
    job: Job,
    reason: string,
  ): Promise<void> {
    this.logger.warn(
      `Moving job ${job.id} to dead letter queue: ${reason}`,
    );

    try {
      await this.deadLetterQueue.add(
        'dead-letter-job',
        {
          originalJobId: job.id,
          originalQueueName: job.queueName || 'unknown',
          jobData: job.data,
          reason,
          failedAt: new Date().toISOString(),
          attempts: job.attemptsMade,
        },
        {
          jobId: `dlq-${job.id}`,
          removeOnComplete: false,
        },
      );
    } catch (error) {
      this.logger.error(`Failed to move job to DLQ: ${error.message}`);
    }
  }

  /**
   * Enqueue waitlist expiry scan job
   */
  async enqueueWaitlistExpiryScan(): Promise<void> {
    try {
      await this.waitlistExpiryQueue.add('scan-expiries', {}, {
        jobId: `scan-expiries-${new Date().toISOString().split('T')[0]}`,
        removeOnComplete: true,
      });
    } catch (error) {
      this.logger.error(`Failed to enqueue waitlist expiry scan: ${error.message}`);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(queueName: QueueName, jobId: string) {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      return {
        id: job.id,
        name: job.name,
        progress: typeof job.progress === 'function' ? job.progress() : job.progress,
        status: await job.getState(),
        data: job.data,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        failedReason: job.failedReason,
        stackTrace: job.stacktrace,
        createdAt: new Date(job.timestamp),
      };
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName) {
    try {
      const queue = this.getQueue(queueName);
      const counts = await queue.getJobCounts();

      return {
        queueName,
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
        totalJobs: Object.values(counts).reduce((a, b) => a + b, 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all queue statistics
   */
  async getAllQueueStats() {
    const stats: any[] = [];
    for (const queueName of Object.values(QueueName)) {
      try {
        stats.push(await this.getQueueStats(queueName as QueueName));
      } catch (error) {
        this.logger.error(
          `Failed to get stats for queue ${queueName}: ${error.message}`,
        );
      }
    }
    return stats;
  }

  /**
   * Pause all jobs in a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.pause();
      this.logger.log(`Queue ${queueName} paused`);
    } catch (error) {
      this.logger.error(`Failed to pause queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume all jobs in a queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.resume();
      this.logger.log(`Queue ${queueName} resumed`);
    } catch (error) {
      this.logger.error(`Failed to resume queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear a queue
   */
  async clearQueue(queueName: QueueName): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      await queue.clean(0, 0);
      this.logger.log(`Queue ${queueName} cleared`);
    } catch (error) {
      this.logger.error(`Failed to clear queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get failed jobs for a queue
   */
  async getFailedJobs(queueName: QueueName, start = 0, end = -1) {
    try {
      const queue = this.getQueue(queueName);
      const failedJobs = await queue.getFailed(start, end);

      return failedJobs.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        stackTrace: job.stacktrace,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        failedAt: job.finishedOn,
      }));
    } catch (error) {
      this.logger.error(`Failed to get failed jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(queueName: QueueName, jobId: string): Promise<Job> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      this.logger.log(`Retrying job ${jobId}`);
      await job.retry();
      return job;
    } catch (error) {
      this.logger.error(`Failed to retry job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: QueueName, jobId: string): Promise<void> {
    try {
      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} removed`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove job: ${error.message}`);
      throw error;
    }
  }
}
