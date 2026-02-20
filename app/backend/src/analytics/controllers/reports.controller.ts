import { Controller, Get, Post, Body, Param, Query, UseGuards, Delete, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from '../services/report.service';
import { CreateReportDto } from '../dto/create-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import * as path from 'path';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createReport(@Body() createReportDto: CreateReportDto) {
    return await this.reportService.createReport(createReportDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getReport(@Param('id') id: string) {
    return await this.reportService.getReportById(id);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserReports(@Param('userId') userId: string) {
    return await this.reportService.getUserReports(userId);
  }

  @Post(':id/generate')
  @UseGuards(JwtAuthGuard)
  async generateReport(@Param('id') id: string) {
    return await this.reportService.generateReport(id);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const report = await this.reportService.getReportById(id);

    if (!report.filePath) {
      return res.status(404).send({ message: 'Report file not found' });
    }

    // Check if file exists
    if (!require('fs').existsSync(report.filePath)) {
      return res.status(404).send({ message: 'Report file not found on disk' });
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(report.filePath).toLowerCase();
    const mimeTypes = {
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.txt': 'text/plain',
    };

    const contentType = mimeTypes[ext as keyof typeof mimeTypes] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(report.filePath)}"`);

    res.sendFile(report.filePath);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateReportStatus(
    @Param('id') id: string,
    @Query('status') status: string
  ) {
    return await this.reportService.updateReportStatus(id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteReport(@Param('id') id: string) {
    await this.reportService.deleteReport(id);
    return { message: 'Report deleted successfully' };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllReports(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
    @Query('status') status?: string,
    @Query('format') format?: string
  ) {
    // This would need to be expanded to support filtering and pagination
    // For now, returning all reports with basic filtering
    let whereClause: any = {};
    
    if (status) {
      whereClause.status = status;
    }
    
    if (format) {
      whereClause.format = format;
    }

    // In a real implementation, you'd use TypeORM's find with where clause
    // For now, we'll just return a placeholder
    return { message: 'List of reports', limit, offset, filters: { status, format } };
  }
}