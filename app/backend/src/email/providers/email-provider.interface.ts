export interface EmailProviderOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string[];
  cc?: string[];
  bcc?: string[];
  attachments?: Attachment[];
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailSendResult {
  messageId: string;
  success: boolean;
  timestamp: Date;
  provider: string;
  error?: string;
}

export interface EmailProvider {
  send(options: EmailProviderOptions): Promise<EmailSendResult>;
  sendBatch(options: EmailProviderOptions[]): Promise<EmailSendResult[]>;
  verifyEmail(email: string): Promise<boolean>;
  getDeliveryStatus(messageId: string): Promise<any>;
}
