import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Report } from '../entities/report.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { AnalyticsService } from './analytics.service';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-writer';
import * as ExcelJS from 'exceljs';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  private readonly reportsDir = path.join(__dirname, '../../../reports');

  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private analyticsService: AnalyticsService,
  ) {
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Create a new report
   */
  async createReport(createReportDto: CreateReportDto): Promise<Report> {
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
      report.status = 'completed'; // For immediate reports
      report.isActive = false;
    }

    return await this.reportRepository.save(report);
  }

  /**
   * Generate a report based on the report definition
   */
  async generateReport(reportId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new BadRequestException('Report not found');
    }

    try {
      report.status = 'processing';
      await this.reportRepository.save(report);

      // Get analytics data based on report filters
      const query = {
        eventId: report.eventId,
        userId: report.userId,
        ...report.filters,
      };

      // This is a simplified approach - in reality, you'd need to build complex queries
      // based on the report configuration
      const analyticsData = await this.analyticsService.getAnalytics({
        eventId: report.eventId,
        ...report.filters,
        limit: 10000 // reasonable limit for reports
      } as any);

      // Generate report file based on format
      const filePath = await this.generateReportFile(report, analyticsData.data);

      report.filePath = filePath;
      report.status = 'completed';
      report.lastRunAt = new Date();

      // Calculate next run if scheduled
      if (report.isScheduled && report.scheduleConfig) {
        report.nextRunAt = this.calculateNextRun(report.scheduleConfig.cronExpression);
      }

      return await this.reportRepository.save(report);
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}: ${error.message}`);
      report.status = 'failed';
      report.errorMessage = error.message;
      await this.reportRepository.save(report);
      throw new InternalServerErrorException('Failed to generate report');
    }
  }

  /**
   * Generate report file based on format
   */
  private async generateReportFile(report: Report, data: any[]): Promise<string> {
    const fileName = `${report.id}_${Date.now()}.${report.format}`;
    const filePath = path.join(this.reportsDir, fileName);

    switch (report.format.toLowerCase()) {
      case 'csv':
        return await this.generateCSV(filePath, data, report.columns);
      case 'excel':
        return await this.generateExcel(filePath, data, report.columns);
      case 'pdf':
        return await this.generatePDF(filePath, data, report.columns, report.title);
      default:
        throw new BadRequestException(`Unsupported format: ${report.format}`);
    }
  }

  /**
   * Generate CSV report
   */
  private async generateCSV(filePath: string, data: any[], columns: string[]): Promise<string> {
    try {
      const csvWriter = csv.createObjectCsvWriter({
        path: filePath,
        header: columns.map(col => ({ id: col, title: col })),
      });

      await csvWriter.writeRecords(data);
      return filePath;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate CSV: ${error.message}`);
    }
  }

  /**
   * Generate Excel report
   */
  private async generateExcel(filePath: string, data: any[], columns: string[]): Promise<string> {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Analytics Report');

      // Add headers
      worksheet.addRow(columns);

      // Add data rows
      data.forEach(item => {
        const row = columns.map(col => item[col] || '');
        worksheet.addRow(row);
      });

      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 15; // Default width
      });

      await workbook.xlsx.writeFile(filePath);
      return filePath;
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate Excel: ${error.message}`);
    }
  }

  /**
   * Generate PDF report (placeholder - would need a PDF library like pdfkit or puppeteer)
   */
  private async generatePDF(filePath: string, data: any[], columns: string[], title: string): Promise<string> {
    // For now, we'll create a basic text representation since we don't have a PDF library installed
    try {
      let content = `REPORT: ${title}\n\n`;
      content += `${columns.join('\t')}\n`;
      
      data.forEach(item => {
        const row = columns.map(col => item[col] || '');
        content += `${row.join('\t')}\n`;
      });

      fs.writeFileSync(filePath.replace('.pdf', '.txt'), content);
      // Convert to actual PDF would require installing a PDF library
      // For now, we'll just return a placeholder
      return filePath.replace('.pdf', '.txt');
    } catch (error) {
      throw new InternalServerErrorException(`Failed to generate PDF: ${error.message}`);
    }
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
   * Get a specific report by ID
   */
  async getReportById(reportId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new BadRequestException('Report not found');
    }

    return report;
  }

  /**
   * Schedule reports that are pending
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async processScheduledReports() {
    this.logger.log('Processing scheduled reports...');
    
    const pendingReports = await this.reportRepository.find({
      where: {
        isScheduled: true,
        isActive: true,
        nextRunAt: LessThanOrEqual(new Date()),
      },
    });

    for (const report of pendingReports) {
      try {
        await this.generateReport(report.id);
        
        // Update next run time
        if (report.scheduleConfig?.cronExpression) {
          report.nextRunAt = this.calculateNextRun(report.scheduleConfig.cronExpression);
          await this.reportRepository.save(report);
        }
      } catch (error) {
        this.logger.error(`Failed to process scheduled report ${report.id}: ${error.message}`);
      }
    }
  }

  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string): Date {
    // Simplified calculation - in production you'd use a cron library like node-cron
    // For now, just add 1 hour as a placeholder
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    return nextRun;
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new BadRequestException('Report not found');
    }

    // Delete the report file if it exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }

    await this.reportRepository.remove(report);
  }

  /**
   * Update report status
   */
  async updateReportStatus(reportId: string, status: string): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    
    if (!report) {
      throw new BadRequestException('Report not found');
    }

    report.status = status;
    return await this.reportRepository.save(report);
  }
}