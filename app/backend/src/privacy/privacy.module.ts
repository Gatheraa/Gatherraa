import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyPolicy } from './entities/privacy-policy.entity';
import { PrivacyConsent } from './entities/privacy-consent.entity';
import { DataProcessingRecord } from './entities/data-processing-record.entity';
import { DataBreach } from './entities/data-breach.entity';
import { PrivacyAudit } from './entities/privacy-audit.entity';
import { PrivacyFrameworkService } from './services/privacy-framework.service';
import { DataAnonymizationService } from './services/data-anonymization.service';
import { ConsentManagementService } from './services/consent-management.service';
import { BreachDetectionService } from './services/breach-detection.service';
import { ComplianceMonitoringService } from './services/compliance-monitoring.service';
import { PrivacyImpactAssessmentService } from './services/privacy-impact-assessment.service';
import { CrossBorderTransferService } from './services/cross-border-transfer.service';
import { PrivacyEnhancingTechnologiesService } from './services/privacy-enhancing-technologies.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrivacyPolicy,
      PrivacyConsent,
      DataProcessingRecord,
      DataBreach,
      PrivacyAudit,
    ]),
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'user',
          pass: process.env.SMTP_PASS || 'pass',
        },
      },
      defaults: {
        from: process.env.SMTP_FROM || 'noreply@gathera.io',
      },
      template: {
        dir: join(__dirname, 'templates'),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [
    PrivacyFrameworkService,
    DataAnonymizationService,
    ConsentManagementService,
    BreachDetectionService,
    ComplianceMonitoringService,
    PrivacyImpactAssessmentService,
    CrossBorderTransferService,
    PrivacyEnhancingTechnologiesService,
  ],
  exports: [
    PrivacyFrameworkService,
    DataAnonymizationService,
    ConsentManagementService,
    BreachDetectionService,
    ComplianceMonitoringService,
    PrivacyImpactAssessmentService,
    CrossBorderTransferService,
    PrivacyEnhancingTechnologiesService,
  ],
})
export class PrivacyModule {}
