// Task Queue Controller
// Exposes endpoints for managing background jobs and queues

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { TaskQueueService, QueueName } from './services/task-queue.service';

@Controller('api/task-queue')
export class TaskQueueController {
  private readonly logger = new Logger(TaskQueueController.name);

  constructor(private taskQueueService: TaskQueueService) {}

  /**
   * Enqueue an email job
   * POST /api/task-queue/email
   */
  @Post('email')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueEmail(
    @Body() data: {
      to: string;
      subject: string;
      template: string;
      context?: any;
      priority?: number;
      delay?: number;
    },
  ) {
    try {
      const job = await this.taskQueueService.enqueueEmail(
        {
          to: data.to,
          subject: data.subject,
          template: data.template,
          context: data.context,
        },
        {
          priority: data.priority || 0,
          delay: data.delay,
        },
      );

      return {
        success: true,
        jobId: job.id,
        queueName: 'email',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to enqueue email: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue an image processing job
   * POST /api/task-queue/image-processing
   */
  @Post('image-processing')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueImageProcessing(
    @Body() data: {
      url: string;
      transformations: any[];
      outputFormat?: string;
      quality?: number;
      priority?: number;
    },
  ) {
    try {
      const job = await this.taskQueueService.enqueueImageProcessing(
        {
          url: data.url,
          transformations: data.transformations,
          outputFormat: data.outputFormat,
          quality: data.quality,
        },
        {
          priority: data.priority || 0,
        },
      );

      return {
        success: true,
        jobId: job.id,
        queueName: 'image-processing',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to enqueue image processing: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue a blockchain event job
   * POST /api/task-queue/blockchain-event
   */
  @Post('blockchain-event')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueBlockchainEvent(
    @Body() data: {
      contractAddress: string;
      eventName: string;
      parameters: any;
      networkId?: string;
      priority?: number;
    },
  ) {
    try {
      const job = await this.taskQueueService.enqueueBlockchainEvent(
        {
          contractAddress: data.contractAddress,
          eventName: data.eventName,
          parameters: data.parameters,
          networkId: data.networkId,
        },
        {
          priority: data.priority || 1,
        },
      );

      return {
        success: true,
        jobId: job.id,
        queueName: 'blockchain-events',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to enqueue blockchain event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue a notification job
   * POST /api/task-queue/notification
   */
  @Post('notification')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueNotification(
    @Body() data: {
      userId: string;
      type: string;
      message: string;
      metadata?: any;
      priority?: number;
    },
  ) {
    try {
      const job = await this.taskQueueService.enqueueNotification(
        {
          userId: data.userId,
          type: data.type,
          message: data.message,
          metadata: data.metadata,
        },
        {
          priority: data.priority || 5,
        },
      );

      return {
        success: true,
        jobId: job.id,
        queueName: 'notifications',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to enqueue notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get job status
   * GET /api/task-queue/status/:queueName/:jobId
   */
  @Get('status/:queueName/:jobId')
  async getJobStatus(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      const status = await this.taskQueueService.getJobStatus(
        queueName as QueueName,
        jobId,
      );

      if (!status) {
        return {
          found: false,
          message: 'Job not found',
        };
      }

      return {
        found: true,
        job: status,
      };
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get queue statistics
   * GET /api/task-queue/stats
   */
  @Get('stats')
  async getQueueStats(@Query('queueName') queueName?: string) {
    try {
      if (queueName) {
        const stats = await this.taskQueueService.getQueueStats(
          queueName as QueueName,
        );
        return { stats };
      }

      const allStats = await this.taskQueueService.getAllQueueStats();
      return { stats: allStats };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pause a queue
   * POST /api/task-queue/:queueName/pause
   */
  @Post(':queueName/pause')
  @HttpCode(HttpStatus.OK)
  async pauseQueue(@Param('queueName') queueName: string) {
    try {
      await this.taskQueueService.pauseQueue(queueName as QueueName);

      return {
        success: true,
        message: `Queue ${queueName} paused`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to pause queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume a queue
   * POST /api/task-queue/:queueName/resume
   */
  @Post(':queueName/resume')
  @HttpCode(HttpStatus.OK)
  async resumeQueue(@Param('queueName') queueName: string) {
    try {
      await this.taskQueueService.resumeQueue(queueName as QueueName);

      return {
        success: true,
        message: `Queue ${queueName} resumed`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to resume queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear a queue
   * DELETE /api/task-queue/:queueName
   */
  @Post(':queueName/clear')
  @HttpCode(HttpStatus.OK)
  async clearQueue(@Param('queueName') queueName: string) {
    try {
      await this.taskQueueService.clearQueue(queueName as QueueName);

      return {
        success: true,
        message: `Queue ${queueName} cleared`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to clear queue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get failed jobs for a queue (Administrative endpoint)
   * GET /api/task-queue/admin/failed?queue=...
   * Required by Acceptance Criteria: GET /admin/queue/failed?queue=...
   */
  @Get('admin/failed')
  async getAdminFailedJobs(
    @Query('queue') queueName: string,
    @Query('start') start: string = '0',
    @Query('end') end: string = '-1',
  ) {
    try {
      if (!queueName) {
        throw new Error('Queue name is required');
      }

      // Check if they want the DLQ specifically or just failed jobs from a queue
      // Acceptance Criteria says "push to *:dlq queue", so we should check the DLQ
      const dlqName = queueName.endsWith(':dlq') ? queueName : `${queueName}:dlq`;
      const dlqJobs = await this.taskQueueService.getDlqJobs(
        dlqName.replace(':dlq', ''),
        parseInt(start),
        parseInt(end),
      );

      // Also try to get failed jobs from the main queue
      const mainQueueName = queueName.endsWith(':dlq') ? queueName.replace(':dlq', '') : queueName;
      const mainFailed = await this.taskQueueService.getFailedJobs(
        mainQueueName as QueueName,
        parseInt(start),
        parseInt(end),
      );

      return {
        queueName: mainQueueName,
        dlqName,
        dlqCount: dlqJobs.length,
        mainFailedCount: mainFailed.length,
        dlqJobs: dlqJobs,
        mainFailedJobs: mainFailed,
      };
    } catch (error) {
      this.logger.error(`Failed to get admin failed jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get failed jobs for a queue
   * GET /api/task-queue/:queueName/failed
   */
  @Get(':queueName/failed')
  async getFailedJobs(
    @Param('queueName') queueName: string,
    @Query('start') start: string = '0',
    @Query('end') end: string = '-1',
  ) {
    try {
      const failed = await this.taskQueueService.getFailedJobs(
        queueName as QueueName,
        parseInt(start),
        parseInt(end),
      );

      return {
        queueName,
        count: failed.length,
        jobs: failed,
      };
    } catch (error) {
      this.logger.error(`Failed to get failed jobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retry a failed job
   * POST /api/task-queue/:queueName/retry/:jobId
   */
  @Post(':queueName/retry/:jobId')
  @HttpCode(HttpStatus.OK)
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      const job = await this.taskQueueService.retryFailedJob(
        queueName as QueueName,
        jobId,
      );

      return {
        success: true,
        jobId: job.id,
        message: 'Job queued for retry',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to retry job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a job
   * DELETE /api/task-queue/:queueName/:jobId
   */
  @Post(':queueName/remove/:jobId')
  @HttpCode(HttpStatus.OK)
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    try {
      await this.taskQueueService.removeJob(queueName as QueueName, jobId);

      return {
        success: true,
        message: `Job ${jobId} removed`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to remove job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check endpoint
   * GET /api/task-queue/health
   */
  @Get('health')
  async getHealth() {
    try {
      const stats = await this.taskQueueService.getAllQueueStats();

      const totalActive = stats.reduce((sum, s) => sum + s.active, 0);
      const totalFailed = stats.reduce((sum, s) => sum + s.failed, 0);
      const totalWaiting = stats.reduce((sum, s) => sum + s.waiting, 0);

      return {
        status: 'healthy',
        timestamp: new Date(),
        summary: {
          activeJobs: totalActive,
          failedJobs: totalFailed,
          waitingJobs: totalWaiting,
          queueCount: stats.length,
        },
        details: stats,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);

      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message,
      };
    }
  }
}
