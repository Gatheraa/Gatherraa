import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { v4 as uuid } from 'uuid';

@Injectable()
export class EmailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendTransactionalEmail(
    to: string,
    template: string,
    context: any,
    attachments?: any[],
  ) {
    const messageId = uuid();

    await this.mailerService.sendMail({
      to,
      subject: context.subject,
      template,
      context,
      attachments,
      headers: {
        'X-Message-ID': messageId,
      },
    });

    return messageId;
  }

  async sendMarketingEmail(to: string, template: string, context: any) {
    return this.sendTransactionalEmail(to, template, context);
  }
}