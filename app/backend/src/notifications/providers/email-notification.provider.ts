import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

@Injectable()
export class EmailNotificationProvider {
  private readonly logger = new Logger(EmailNotificationProvider.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailService = this.configService.get('EMAIL_SERVICE') || 'gmail';
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');
    const smtpHost = this.configService.get('SMTP_HOST');
    const smtpPort = this.configService.get('SMTP_PORT');
    const smtpSecure = this.configService.get('SMTP_SECURE') === 'true';
    const smtpUser = this.configService.get('SMTP_USER');
    const smtpPassword = this.configService.get('SMTP_PASSWORD');

    // Use SMTP config if available, otherwise fall back to standard service
    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort) || 587,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        service: emailService,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });
    }

    // Verify connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`Email transporter verification failed: ${error.message}`);
      } else {
        this.logger.log('Email transporter verified and ready');
      }
    });
  }

  /**
   * Send email notification
   */
  async sendEmail(options: EmailOptions): Promise<string> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.configService.get('EMAIL_FROM') || 'noreply@gatheraa.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        replyTo: options.replyTo,
      });

      this.logger.log(`Email sent to ${options.to}, message ID: ${info.messageId}`);
      return info.messageId;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailOptions[]): Promise<Map<string, string | Error>> {
    const results = new Map<string, string | Error>();

    for (const emailOption of emails) {
      try {
        const messageId = await this.sendEmail(emailOption);
        results.set(emailOption.to, messageId);
      } catch (error) {
        results.set(emailOption.to, error);
      }
    }

    return results;
  }

  /**
   * Verify email address (basic validation)
   */
  async verifyEmailAddress(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Strip HTML tags from string
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Health check for email service
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`Email service health check failed: ${error.message}`);
      return false;
    }
  }
}
