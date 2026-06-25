// Email Job Processor
// Handles sending emails through the queue

import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';

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
@Processor('email')
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Initialize email transporter
    // In production, this should be configured via environment variables
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
  @Process({ concurrency: 5 })
  async handleEmailJob(job: Job<EmailJobData>) {
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

      // Provide detailed error for logging
      throw {
        message: error.message,
        code: error.code,
        statusCode: error.responseCode,
        originalError: error,
      };
    }
  }

  /**
   * Render email template with context
   * In production, use a proper template engine like Handlebars or EJS
   */
  private renderEmailTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    let html = template;

    // Simple variable replacement
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    }

    return html;
  }
}
