import { Controller, Get, Post, Body, Param, Query, UseGuards, Put, Delete } from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { CreateEventAnalyticsDto } from '../dto/create-event.dto';
import { AnalyticsQueryDto } from '../dto/analytics-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('track')
  @UseGuards(JwtAuthGuard)
  async trackEvent(@Body() createEventDto: CreateEventAnalyticsDto) {
    return await this.analyticsService.trackEvent(createEventDto);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboardMetrics(@Query('timePeriod') timePeriod?: string) {
    return await this.analyticsService.getDashboardMetrics(timePeriod);
  }

  @Get('events/:eventId')
  @UseGuards(JwtAuthGuard)
  async getEventAnalytics(
    @Param('eventId') eventId: string,
    @Query('timePeriod') timePeriod?: string
  ) {
    return await this.analyticsService.getEventAnalytics(eventId, timePeriod);
  }

  @Get('data')
  @UseGuards(JwtAuthGuard)
  async getAnalyticsData(@Query() queryDto: AnalyticsQueryDto) {
    return await this.analyticsService.getAnalytics(queryDto);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async getSummary(
    @Query('period') period?: string,
    @Query('metricType') metricType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Implementation would depend on the AnalyticsSummary entity
    // For now, return a placeholder response
    return { message: 'Summary endpoint is under construction' };
  }
}