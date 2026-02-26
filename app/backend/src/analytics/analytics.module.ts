import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventAnalytics } from './entities/event-analytics.entity';
import { AnalyticsSummary } from './entities/analytics-summary.entity';
import { Report } from './entities/report.entity';
import { UserBehaviorAnalytics } from './entities/user-behavior-analytics.entity';
import { MarketTrend } from './entities/market-trend.entity';
import { AnalyticsService } from './services/analytics.service';
import { ReportService } from './services/report.service';
import { DataRetentionService } from './services/data-retention.service';
import { AnomalyDetectionService } from './services/anomaly-detection.service';
import { PrivacyControlService } from './services/privacy-control.service';
import { AdvancedAnalyticsService } from './services/advanced-analytics.service';
import { UserBehaviorService } from './services/user-behavior.service';
import { MarketTrendService } from './services/market-trend.service';
import { AdvancedReportService } from './services/advanced-report.service';
import { DataVisualizationService } from './services/data-visualization.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { ReportsController } from './controllers/reports.controller';
import { AdvancedAnalyticsController } from './controllers/advanced-analytics.controller';
import { AdvancedReportsController } from './controllers/advanced-reports.controller';
import { DataVisualizationController } from './controllers/data-visualization.controller';
import { AnalyticsApiController } from './controllers/analytics-api.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventAnalytics, AnalyticsSummary, Report, UserBehaviorAnalytics, MarketTrend]),
  ],
  controllers: [AnalyticsController, ReportsController, AdvancedAnalyticsController, AdvancedReportsController, DataVisualizationController, AnalyticsApiController],
  providers: [
    AnalyticsService,
    ReportService,
    DataRetentionService,
    AnomalyDetectionService,
    PrivacyControlService,
    AdvancedAnalyticsService,
    UserBehaviorService,
    MarketTrendService,
    AdvancedReportService,
    DataVisualizationService,
  ],
  exports: [
    AnalyticsService,
    ReportService,
    DataRetentionService,
    AnomalyDetectionService,
    PrivacyControlService,
    AdvancedAnalyticsService,
    UserBehaviorService,
    MarketTrendService,
    AdvancedReportService,
    DataVisualizationService,
  ],
})
export class AnalyticsModule { }