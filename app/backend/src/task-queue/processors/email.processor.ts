// Email Job Processor
// Handles sending emails through the queue

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { TaskQueueService } from '../services/task-queue.service';
import { NotificationsGateway } from '../../notifications/gateway/notifications.gateway';

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  context?: Record<string, any>;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
  }>;
}

/**
 * Processor for email jobs
 * Sends emails with retry logic and error handling
 */
@Processor('email', { concurrency: 5 })
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly taskQueueService: TaskQueueService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {
    super();
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 7,
    });
  }

  /**
   * Process email sending job
   */
  async process(job: Job<EmailJobData>): Promise<any> {
    const jobId = job.id;
    const { to, subject, template, context } = job.data;

    try {
      this.logger.log(`Processing email job ${jobId} to ${to}`);

      // Update progress
      await job.updateProgress(25);

      // Render email template (basic implementation)
      const htmlContent = this.renderEmailTemplate(template, context || {});
      await job.updateProgress(50);

      // Send email
      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gatherraa.com',
        to,
        cc: job.data.cc,
        bcc: job.data.bcc,
        subject,
        html: htmlContent,
        attachments: job.data.attachments,
      });

      await job.updateProgress(75);

      this.logger.log(
        `Email sent successfully to ${to} (MessageID: ${result.messageId})`,
      );

      await job.updateProgress(100);

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process email job ${jobId}: ${error.message}`,
        error.stack,
      );

      throw error;
    }
  }

  /**
   * Domain Aware failure hook for Email Failures
   */
  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.warn(`Email Job ${job.id} failed permanently. Routing to DLQ and notifying admin.`);
      
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

  /**
   * Render email template with context
   */
  private renderEmailTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    let html = template;

    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    }

    return html;
  }
}
