import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from '../entities/report.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { AnalyticsService } from './analytics.service';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-writer';
import * as ExcelJS from 'exceljs';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AdvancedReportService {
  private readonly logger = new Logger(AdvancedReportService.name);
  private readonly reportsDir = path.join(__dirname, '../../../reports');

  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private analyticsService: AnalyticsService,
    private advancedAnalyticsService: AdvancedAnalyticsService,
  ) {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Create a comprehensive analytics report
   */
  async createComprehensiveReport(createReportDto: CreateReportDto): Promise<Report> {
    const report = new Report();
    
    report.title = createReportDto.title;
    report.description = createReportDto.description;
    report.filters = createReportDto.filters;
    report.columns = createReportDto.columns;
    report.format = createReportDto.format;
    report.userId = createReportDto.userId;
    report.eventId = createReportDto.eventId;
    report.isScheduled = createReportDto.isScheduled || false;
    report.scheduleConfig = createReportDto.scheduleConfig;
    
    if (report.isScheduled && report.scheduleConfig) {
      report.status = 'pending';
      report.isActive = true;
    } else {
      report.status = 'pending'; // Will be processed immediately
      report.isActive = false;
    }

    const savedReport = await this.reportRepository.save(report);

    // Generate the report immediately if not scheduled
    if (!report.isScheduled) {
      await this.generateComprehensiveReport(savedReport.id);
    }

    return savedReport;
  }

  /**
   * Generate comprehensive report with advanced analytics
   */
  async generateComprehensiveReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new Error('Report not found');
    }

    try {
      report.status = 'processing';
      await this.reportRepository.save(report);

      // Gather comprehensive data
      const reportData = await this.gatherReportData(report);

      // Generate report file based on format
      const filePath = await this.generateAdvancedReportFile(report, reportData);

      report.filePath = filePath;
      report.status = 'completed';
      report.lastRunAt = new Date();

      // Calculate next run if scheduled
      if (report.isScheduled && report.scheduleConfig) {
        report.nextRunAt = this.calculateNextRun(report.scheduleConfig.cronExpression);
      }

      return await this.reportRepository.save(report);
    } catch (error) {
      this.logger.error(`Failed to generate comprehensive report ${reportId}: ${error.message}`);
      report.status = 'failed';
      report.errorMessage = error.message;
      await this.reportRepository.save(report);
      throw error;
    }
  }

  /**
   * Gather comprehensive data for reports
   */
  private async gatherReportData(report: Report) {
    const timePeriod = report.filters?.timePeriod || 'last_30_days';
    
    // Basic analytics data
    const basicAnalytics = await this.analyticsService.getAnalytics({
      eventId: report.eventId,
      userId: report.userId,
      ...report.filters,
      limit: 10000
    } as any);

    // Advanced KPIs
    const dashboardKPIs = await this.advancedAnalyticsService.getDashboardKPIs(timePeriod);

    // User behavior analytics
    const userBehavior = await this.advancedAnalyticsService.getUserBehaviorAnalytics({
      timePeriod,
      limit: 5000
    } as any);

    // Market trends
    const marketTrends = await this.advancedAnalyticsService.getMarketTrendAnalysis({
      timePeriod,
      includePredictions: true
    } as any);

    // Real-time metrics
    const realTimeMetrics = await this.advancedAnalyticsService.getRealTimeMetrics();

    return {
      summary: {
        reportTitle: report.title,
        generatedAt: new Date(),
        timePeriod,
        totalRecords: basicAnalytics.data.length
      },
      basicAnalytics,
      dashboardKPIs,
      userBehavior,
      marketTrends,
      realTimeMetrics,
      insights: this.generateInsights(basicAnalytics, dashboardKPIs, userBehavior, marketTrends)
    };
  }

  /**
   * Generate insights from analytics data
   */
  private generateInsights(basicAnalytics: any, dashboardKPIs: any, userBehavior: any, marketTrends: any) {
    const insights = [];

    // Growth insights
    if (dashboardKPIs.growth?.totalEvents > 10) {
      insights.push({
        type: 'growth',
        title: 'Strong Event Growth',
        description: `Events increased by ${dashboardKPIs.growth.totalEvents.toFixed(1)}% in the selected period`,
        priority: 'high'
      });
    }

    // User engagement insights
    if (userBehavior.engagementScore > 70) {
      insights.push({
        type: 'engagement',
        title: 'High User Engagement',
        description: `User engagement score is ${userBehavior.engagementScore}, indicating strong user interaction`,
        priority: 'medium'
      });
    }

    // Market trend insights
    if (marketTrends.analysis?.trendDirection === 'bullish') {
      insights.push({
        type: 'market',
        title: 'Bullish Market Trend',
        description: 'Market trends show positive growth trajectory',
        priority: 'high'
      });
    }

    // Session duration insights
    if (dashboardKPIs.engagement?.avgSessionDuration < 60) {
      insights.push({
        type: 'engagement',
        title: 'Low Session Duration',
        description: 'Average session duration is below 60 seconds, consider improving user experience',
        priority: 'medium'
      });
    }

    return insights;
  }

  /**
   * Generate advanced report file with charts and visualizations
   */
  private async generateAdvancedReportFile(report: Report, data: any): Promise<string> {
    const fileName = `${report.id}_${Date.now()}.${report.format}`;
    const filePath = path.join(this.reportsDir, fileName);

    switch (report.format.toLowerCase()) {
      case 'csv':
        return await this.generateAdvancedCSV(filePath, data);
      case 'excel':
        return await this.generateAdvancedExcel(filePath, data);
      case 'json':
        return await this.generateJSON(filePath, data);
      case 'pdf':
        return await this.generateAdvancedPDF(filePath, data, report.title);
      default:
        throw new Error(`Unsupported format: ${report.format}`);
    }
  }

  /**
   * Generate advanced CSV with multiple sheets
   */
  private async generateAdvancedCSV(filePath: string, data: any): Promise<string> {
    try {
      // Create multiple CSV files for different data types
      const baseFileName = filePath.replace('.csv', '');
      
      // Basic analytics CSV
      const basicCSV = csv.createObjectCsvWriter({
        path: `${baseFileName}_basic_analytics.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'eventType', title: 'Event Type' },
          { id: 'userId', title: 'User ID' },
          { id: 'eventId', title: 'Event ID' },
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'source', title: 'Source' }
        ]
      });
      await basicCSV.writeRecords(data.basicAnalytics.data);

      // User behavior CSV
      const behaviorCSV = csv.createObjectCsvWriter({
        path: `${baseFileName}_user_behavior.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'userId', title: 'User ID' },
          { id: 'behaviorType', title: 'Behavior Type' },
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'isConverted', title: 'Converted' },
          { id: 'value', title: 'Value' }
        ]
      });
      await behaviorCSV.writeRecords(data.userBehavior.data);

      // Market trends CSV
      const trendsCSV = csv.createObjectCsvWriter({
        path: `${baseFileName}_market_trends.csv`,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'category', title: 'Category' },
          { id: 'averagePrice', title: 'Average Price' },
          { id: 'totalVolume', title: 'Total Volume' },
          { id: 'timestamp', title: 'Timestamp' }
        ]
      });
      await trendsCSV.writeRecords(data.marketTrends.data);

      // Create a summary file with file references
      const summaryCSV = csv.createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'section', title: 'Section' },
          { id: 'fileName', title: 'File Name' },
          { id: 'recordCount', title: 'Record Count' }
        ]
      });
      
      await summaryCSV.writeRecords([
        { section: 'Basic Analytics', fileName: `${baseFileName}_basic_analytics.csv`, recordCount: data.basicAnalytics.data.length },
        { section: 'User Behavior', fileName: `${baseFileName}_user_behavior.csv`, recordCount: data.userBehavior.data.length },
        { section: 'Market Trends', fileName: `${baseFileName}_market_trends.csv`, recordCount: data.marketTrends.data.length }
      ]);

      return filePath;
    } catch (error) {
      throw new Error(`Failed to generate advanced CSV: ${error.message}`);
    }
  }

  /**
   * Generate advanced Excel with multiple sheets and charts
   */
  private async generateAdvancedExcel(filePath: string, data: any): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.addRow(['Report Summary']);
      summarySheet.addRow(['Title', data.summary.reportTitle]);
      summarySheet.addRow(['Generated At', data.summary.generatedAt]);
      summarySheet.addRow(['Time Period', data.summary.timePeriod]);
      summarySheet.addRow(['Total Records', data.summary.totalRecords]);
      summarySheet.addRow([]);

      // KPIs sheet
      const kpisSheet = workbook.addWorksheet('KPIs');
      kpisSheet.addRow(['Key Performance Indicators']);
      kpisSheet.addRow(['Metric', 'Current', 'Previous', 'Growth %']);
      
      if (data.dashboardKPIs.current) {
        Object.entries(data.dashboardKPIs.current).forEach(([key, value]) => {
          if (typeof value === 'number') {
            const previous = data.dashboardKPIs.previous?.[key] || 0;
            const growth = data.dashboardKPIs.growth?.[key] || 0;
            kpisSheet.addRow([key, value, previous, growth.toFixed(2)]);
          }
        });
      }

      // Basic Analytics sheet
      const analyticsSheet = workbook.addWorksheet('Analytics Data');
      if (data.basicAnalytics.data.length > 0) {
        const headers = Object.keys(data.basicAnalytics.data[0]);
        analyticsSheet.addRow(headers);
        
        data.basicAnalytics.data.forEach(item => {
          const row = headers.map(header => item[header] || '');
          analyticsSheet.addRow(row);
        });
      }

      // User Behavior sheet
      const behaviorSheet = workbook.addWorksheet('User Behavior');
      if (data.userBehavior.data.length > 0) {
        const headers = Object.keys(data.userBehavior.data[0]);
        behaviorSheet.addRow(headers);
        
        data.userBehavior.data.forEach(item => {
          const row = headers.map(header => item[header] || '');
          behaviorSheet.addRow(row);
        });
      }

      // Market Trends sheet
      const trendsSheet = workbook.addWorksheet('Market Trends');
      if (data.marketTrends.data.length > 0) {
        const headers = Object.keys(data.marketTrends.data[0]);
        trendsSheet.addRow(headers);
        
        data.marketTrends.data.forEach(item => {
          const row = headers.map(header => item[header] || '');
          trendsSheet.addRow(row);
        });
      }

      // Insights sheet
      const insightsSheet = workbook.addWorksheet('Insights');
      insightsSheet.addRow(['Type', 'Title', 'Description', 'Priority']);
      
      if (data.insights) {
        data.insights.forEach((insight: any) => {
          insightsSheet.addRow([insight.type, insight.title, insight.description, insight.priority]);
        });
      }

      // Auto-size columns for all sheets
      workbook.eachSheet((worksheet) => {
        worksheet.columns.forEach((column) => {
          column.width = 15;
        });
      });

      await workbook.xlsx.writeFile(filePath);
      return filePath;
    } catch (error) {
      throw new Error(`Failed to generate advanced Excel: ${error.message}`);
    }
  }

  /**
   * Generate JSON report
   */
  private async generateJSON(filePath: string, data: any): Promise<string> {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return filePath;
    } catch (error) {
      throw new Error(`Failed to generate JSON: ${error.message}`);
    }
  }

  /**
   * Generate advanced PDF report (placeholder implementation)
   */
  private async generateAdvancedPDF(filePath: string, data: any, title: string): Promise<string> {
    // For now, create a comprehensive text-based report
    // In production, you would use a library like PDFKit or Puppeteer
    try {
      let content = `COMPREHENSIVE ANALYTICS REPORT\n`;
      content += `===============================\n\n`;
      content += `Title: ${title}\n`;
      content += `Generated: ${data.summary.generatedAt}\n`;
      content += `Time Period: ${data.summary.timePeriod}\n\n`;

      content += `KEY PERFORMANCE INDICATORS\n`;
      content += `-------------------------\n`;
      if (data.dashboardKPIs.current) {
        Object.entries(data.dashboardKPIs.current).forEach(([key, value]) => {
          content += `${key}: ${value}\n`;
        });
      }

      content += `\nINSIGHTS\n`;
      content += `--------\n`;
      if (data.insights) {
        data.insights.forEach((insight: any) => {
          content += `\n${insight.title} (${insight.priority})\n`;
          content += `${insight.description}\n`;
        });
      }

      fs.writeFileSync(filePath.replace('.pdf', '.txt'), content);
      return filePath.replace('.pdf', '.txt');
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    // Simplified calculation - in production you'd use a cron library
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    return nextRun;
  }

  /**
   * Get all reports for a user
   */
  async getUserReports(userId: string): Promise<Report[]> {
    return await this.reportRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get report templates
   */
  getReportTemplates() {
    return [
      {
        id: 'executive_summary',
        name: 'Executive Summary',
        description: 'High-level overview for executives',
        sections: ['dashboardKPIs', 'insights'],
        formats: ['excel', 'pdf']
      },
      {
        id: 'detailed_analytics',
        name: 'Detailed Analytics',
        description: 'Comprehensive analytics with all data',
        sections: ['basicAnalytics', 'userBehavior', 'marketTrends'],
        formats: ['excel', 'csv', 'json']
      },
      {
        id: 'user_behavior_report',
        name: 'User Behavior Report',
        description: 'Focus on user engagement and behavior patterns',
        sections: ['userBehavior', 'dashboardKPIs'],
        formats: ['excel', 'pdf']
      },
      {
        id: 'market_analysis',
        name: 'Market Analysis Report',
        description: 'Market trends and predictions',
        sections: ['marketTrends', 'insights'],
        formats: ['excel', 'pdf']
      }
    ];
  }
}
