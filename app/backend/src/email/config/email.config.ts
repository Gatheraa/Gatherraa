import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'sendgrid', // 'sendgrid' | 'aws-ses' | 'nodemailer'
  
  sendGrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'Gatheraa',
    webhookUrl: process.env.SENDGRID_WEBHOOK_URL,
  },

  awsSes: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com',
    configurationSetName: process.env.AWS_SES_CONFIG_SET || 'default',
  },

  nodeMailer: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: {
      email: process.env.SMTP_FROM_EMAIL || 'noreply@example.com',
      name: process.env.SMTP_FROM_NAME || 'Gatheraa',
    },
  },

  mailer: {
    transport: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    defaults: {
      from: `"${process.env.SMTP_FROM_NAME || 'Gatheraa'}" <${process.env.SMTP_FROM_EMAIL || 'noreply@example.com'}>`,
    },
    preview: process.env.NODE_ENV !== 'production',
  },

  templates: {
    defaultLanguage: process.env.EMAIL_DEFAULT_LANGUAGE || 'en',
    supportedLanguages: (process.env.EMAIL_SUPPORTED_LANGUAGES || 'en,es,fr').split(','),
    templatesDir: process.env.EMAIL_TEMPLATES_DIR || './templates/emails',
  },

  tracking: {
    enablePixelTracking: process.env.EMAIL_PIXEL_TRACKING === 'true',
    enableLinkTracking: process.env.EMAIL_LINK_TRACKING === 'true',
    trackingDomain: process.env.EMAIL_TRACKING_DOMAIN,
  },

  abTesting: {
    enableABTesting: process.env.EMAIL_AB_TESTING === 'true',
    defaultConfidenceLevel: parseFloat(process.env.EMAIL_AB_CONFIDENCE || '0.95'),
  },

  analytics: {
    enableAnalytics: process.env.EMAIL_ANALYTICS === 'true',
    analyticsUpdateInterval: parseInt(process.env.EMAIL_ANALYTICS_INTERVAL || '300000'), // 5 minutes
  },

  bounceHandling: {
    enableBounceHandling: process.env.EMAIL_BOUNCE_HANDLING === 'true',
    maxBounceThreshold: parseInt(process.env.EMAIL_BOUNCE_MAX_THRESHOLD || '5'),
    maxComplaintThreshold: parseInt(process.env.EMAIL_COMPLAINT_MAX_THRESHOLD || '1'),
  },
}));
