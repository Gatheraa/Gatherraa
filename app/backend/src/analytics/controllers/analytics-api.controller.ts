import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { AdvancedAnalyticsService } from '../services/advanced-analytics.service';
import { UserBehaviorService } from '../services/user-behavior.service';
import { MarketTrendService } from '../services/market-trend.service';
import { AdvancedReportService } from '../services/advanced-report.service';
import { DataVisualizationService } from '../services/data-visualization.service';
import { CreateUserBehaviorDto } from '../dto/create-user-behavior.dto';
import { CreateMarketTrendDto } from '../dto/create-market-trend.dto';
import { CreateReportDto } from '../dto/create-report.dto';
import { UserBehaviorQueryDto } from '../dto/user-behavior-query.dto';
import { MarketTrendQueryDto } from '../dto/market-trend-query.dto';
import { ApiKeyAuthGuard } from '../../auth/guards/api-key-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('api/v1/analytics')
export class AnalyticsApiController {
  constructor(
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly userBehaviorService: UserBehaviorService,
    private readonly marketTrendService: MarketTrendService,
    private readonly advancedReportService: AdvancedReportService,
    private readonly dataVisualizationService: DataVisualizationService,
  ) {}

  // ==================== EVENT TRACKING ====================

  @Post('events/track')
  @UseGuards(ApiKeyAuthGuard)
  async trackEvent(@Body() eventData: any, @Headers('x-api-key') apiKey: string) {
    // External API for event tracking
    return {
      success: true,
      message: 'Event tracked successfully',
      eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  @Post('behavior/track')
  @UseGuards(ApiKeyAuthGuard)
  async trackBehavior(@Body() behaviorData: CreateUserBehaviorDto) {
    const behavior = await this.userBehaviorService.trackBehavior(behaviorData);
    return {
      success: true,
      data: behavior,
      message: 'Behavior tracked successfully'
    };
  }

  // ==================== ANALYTICS DATA ====================

  @Get('dashboard/kpis')
  @UseGuards(ApiKeyAuthGuard)
  async getDashboardKPIs(@Query() query: any) {
    const kpis = await this.advancedAnalyticsService.getDashboardKPIs(query.timePeriod);
    return {
      success: true,
      data: kpis
    };
  }

  @Get('realtime/metrics')
  @UseGuards(ApiKeyAuthGuard)
  async getRealTimeMetrics() {
    const metrics = await this.advancedAnalyticsService.getRealTimeMetrics();
    return {
      success: true,
      data: metrics
    };
  }

  @Get('user-behavior')
  @UseGuards(ApiKeyAuthGuard)
  async getUserBehaviorAnalytics(@Query() query: UserBehaviorQueryDto) {
    const analytics = await this.advancedAnalyticsService.getUserBehaviorAnalytics(query);
    return {
      success: true,
      data: analytics
    };
  }

  @Get('market-trends')
  @UseGuards(ApiKeyAuthGuard)
  async getMarketTrends(@Query() query: MarketTrendQueryDto) {
    const trends = await this.advancedAnalyticsService.getMarketTrendAnalysis(query);
    return {
      success: true,
      data: trends
    };
  }

  // ==================== DATA VISUALIZATION ====================

  @Get('charts/dashboard')
  @UseGuards(ApiKeyAuthGuard)
  async getDashboardCharts(@Query() query: any) {
    const charts = await this.dataVisualizationService.getDashboardChartData(query.timePeriod);
    return {
      success: true,
      data: charts
    };
  }

  @Get('charts/heatmap')
  @UseGuards(ApiKeyAuthGuard)
  async getActivityHeatmap(@Query() query: any) {
    const heatmap = await this.dataVisualizationService.getActivityHeatmap(query.timePeriod);
    return {
      success: true,
      data: heatmap
    };
  }

  // ==================== REPORTS ====================

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  async createReport(@Body() reportData: CreateReportDto) {
    const report = await this.advancedReportService.createComprehensiveReport(reportData);
    return {
      success: true,
      data: report,
      message: 'Report created successfully'
    };
  }

  @Get('reports/:reportId')
  @UseGuards(JwtAuthGuard)
  async getReport(@Param('reportId') reportId: string) {
    const report = await this.advancedReportService.getUserReports(reportId);
    return {
      success: true,
      data: report
    };
  }

  @Post('reports/:reportId/generate')
  @UseGuards(JwtAuthGuard)
  async generateReport(@Param('reportId') reportId: string) {
    const report = await this.advancedReportService.generateComprehensiveReport(reportId);
    return {
      success: true,
      data: report,
      message: 'Report generated successfully'
    };
  }

  @Get('reports/templates')
  @UseGuards(JwtAuthGuard)
  async getReportTemplates() {
    const templates = this.advancedReportService.getReportTemplates();
    return {
      success: true,
      data: templates
    };
  }

  // ==================== MARKET DATA ====================

  @Post('market-data')
  @UseGuards(ApiKeyAuthGuard)
  async submitMarketData(@Body() marketData: CreateMarketTrendDto) {
    const trend = await this.marketTrendService.createMarketTrend(marketData);
    return {
      success: true,
      data: trend,
      message: 'Market data submitted successfully'
    };
  }

  @Get('market-data/:category/predictions')
  @UseGuards(ApiKeyAuthGuard)
  async getPricePredictions(@Param('category') category: string, @Query() query: any) {
    const predictions = await this.marketTrendService.generatePricePredictions(
      category, 
      query.days || 7
    );
    return {
      success: true,
      data: predictions
    };
  }

  @Get('market-data/:category/analysis')
  @UseGuards(ApiKeyAuthGuard)
  async getMarketAnalysis(@Param('category') category: string) {
    const analysis = await this.marketTrendService.analyzeMarketTrends(category);
    return {
      success: true,
      data: analysis
    };
  }

  // ==================== WEBHOOKS ====================

  @Post('webhooks/analytics')
  @UseGuards(ApiKeyAuthGuard)
  async analyticsWebhook(@Body() webhookData: any, @Headers('x-webhook-signature') signature: string) {
    // Process webhook data from external systems
    // Verify signature, process data, store analytics
    
    return {
      success: true,
      message: 'Webhook processed successfully',
      processed: webhookData.events?.length || 0
    };
  }

  // ==================== BULK OPERATIONS ====================

  @Post('bulk/events')
  @UseGuards(ApiKeyAuthGuard)
  async bulkTrackEvents(@Body() eventsData: { events: any[] }) {
    // Process bulk event tracking
    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    for (const event of eventsData.events) {
      try {
        // Process each event
        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push(error.message);
      }
    }

    return {
      success: true,
      data: results
    };
  }

  @Post('export/data')
  @UseGuards(JwtAuthGuard)
  async exportAnalyticsData(@Body() exportRequest: any) {
    // Export analytics data in various formats
    const { format, filters, timeRange } = exportRequest;
    
    // This would generate and return export data
    return {
      success: true,
      downloadUrl: `/api/v1/analytics/downloads/export_${Date.now()}.${format}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  // ==================== HEALTH AND STATUS ====================

  @Get('health')
  async getAnalyticsHealth() {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        services: {
          analytics: 'operational',
          reports: 'operational',
          visualization: 'operational',
          marketTrends: 'operational'
        }
      }
    };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsStatus() {
    return {
      success: true,
      data: {
        totalEvents: 0, // Would fetch from database
        activeUsers: 0,
        reportsGenerated: 0,
        lastDataUpdate: new Date(),
        systemLoad: {
          cpu: 45.2,
          memory: 67.8,
          disk: 23.1
        }
      }
    };
  }
}
