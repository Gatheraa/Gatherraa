import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import {
  EmailProvider,
  EmailProviderOptions,
  EmailSendResult,
  Attachment,
} from './email-provider.interface';

@Injectable()
export class SendGridProvider implements EmailProvider {
  private readonly logger = new Logger(SendGridProvider.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('email.sendGrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async send(options: EmailProviderOptions): Promise<EmailSendResult> {
    try {
      const msg = this.buildMessage(options);
      const response = await sgMail.send(msg);

      return {
        messageId: response[0].headers['x-message-id'],
        success: true,
        timestamp: new Date(),
        provider: 'SENDGRID',
      };
    } catch (error) {
      this.logger.error(`Failed to send email via SendGrid: ${error.message}`, error);
      return {
        messageId: '',
        success: false,
        timestamp: new Date(),
        provider: 'SENDGRID',
        error: error.message,
      };
    }
  }

  async sendBatch(options: EmailProviderOptions[]): Promise<EmailSendResult[]> {
    try {
      const messages = options.map((opt) => this.buildMessage(opt));
      const responses = await sgMail.sendMultiple(messages);

      return responses.map((response, index) => ({
        messageId: response.headers['x-message-id'],
        success: true,
        timestamp: new Date(),
        provider: 'SENDGRID',
      }));
    } catch (error) {
      this.logger.error(`Failed to send batch emails via SendGrid: ${error.message}`, error);
      return options.map(() => ({
        messageId: '',
        success: false,
        timestamp: new Date(),
        provider: 'SENDGRID',
        error: error.message,
      }));
    }
  }

  async verifyEmail(email: string): Promise<boolean> {
    // SendGrid doesn't provide a built-in email verification API
    // Implement basic validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getDeliveryStatus(messageId: string): Promise<any> {
    // SendGrid doesn't provide a direct delivery status API
    // Typically handled via webhooks
    return null;
  }

  private buildMessage(options: EmailProviderOptions): any {
    const msg = {
      to: options.to,
      from: {
        email: options.from || this.configService.get('email.sendGrid.fromEmail'),
        name: options.fromName || this.configService.get('email.sendGrid.fromName'),
      },
      replyTo: options.replyTo ? options.replyTo[0] : undefined,
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc,
      bcc: options.bcc,
      headers: options.headers || {},
      attachments: options.attachments ? this.formatAttachments(options.attachments) : undefined,
      customArgs: options.metadata || {},
    };

    if (options.tags) {
      msg.categories = options.tags;
    }

    return msg;
  }

  private formatAttachments(attachments: Attachment[]) {
    return attachments.map((att) => ({
      filename: att.filename,
      content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
      type: att.contentType || 'application/octet-stream',
      disposition: 'attachment',
    }));
  }
}
