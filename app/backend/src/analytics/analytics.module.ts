import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventAnalytics } from './entities/event-analytics.entity';
import { AnalyticsSummary } from './entities/analytics-summary.entity';
import { Report } from './entities/report.entity';
import { AnalyticsService } from './services/analytics.service';
import { ReportService } from './services/report.service';
import { DataRetentionService } from './services/data-retention.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';
import { PrivacyControlService } from './services/privacy-control.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { ReportsController } from './controllers/reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventAnalytics, AnalyticsSummary, Report]),
  ],
  controllers: [AnalyticsController, ReportsController],
  providers: [
    AnalyticsService,
    ReportService,
    DataRetentionService,
    AnomalyDetectionService,
    PrivacyControlService,
  ],
  exports: [
    AnalyticsService,
    ReportService,
    DataRetentionService,
    AnomalyDetectionService,
    PrivacyControlService,
  ],
})
export class AnalyticsModule {}