import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete, Put } from '@nestjs/common';
import { AdvancedReportService } from '../services/advanced-report.service';
import { CreateReportDto } from '../dto/create-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('analytics/reports')
@UseGuards(JwtAuthGuard)
export class AdvancedReportsController {
  constructor(private readonly advancedReportService: AdvancedReportService) {}

  @Post()
  async createReport(@Body() createReportDto: CreateReportDto) {
    return await this.advancedReportService.createComprehensiveReport(createReportDto);
  }

  @Get('templates')
  async getReportTemplates() {
    return this.advancedReportService.getReportTemplates();
  }

  @Get('user/:userId')
  async getUserReports(@Param('userId') userId: string) {
    return await this.advancedReportService.getUserReports(userId);
  }

  @Post(':reportId/generate')
  async generateReport(@Param('reportId') reportId: string) {
    return await this.advancedReportService.generateComprehensiveReport(reportId);
  }

  @Get(':reportId')
  async getReport(@Param('reportId') reportId: string) {
    return await this.advancedReportService.getUserReports(reportId);
  }
}
