import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdvancedAnalyticsService } from '../services/advanced-analytics.service';
import { UserBehaviorQueryDto } from '../dto/user-behavior-query.dto';
import { MarketTrendQueryDto } from '../dto/market-trend-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('analytics/advanced')
@UseGuards(JwtAuthGuard)
export class AdvancedAnalyticsController {
  constructor(private readonly advancedAnalyticsService: AdvancedAnalyticsService) {}

  @Get('dashboard/kpis')
  async getDashboardKPIs(@Query('timePeriod') timePeriod?: string) {
    return await this.advancedAnalyticsService.getDashboardKPIs(timePeriod);
  }

  @Get('realtime')
  async getRealTimeMetrics() {
    return await this.advancedAnalyticsService.getRealTimeMetrics();
  }

  @Get('user-behavior')
  async getUserBehaviorAnalytics(@Query() queryDto: UserBehaviorQueryDto) {
    return await this.advancedAnalyticsService.getUserBehaviorAnalytics(queryDto);
  }

  @Get('market-trends')
  async getMarketTrendAnalysis(@Query() queryDto: MarketTrendQueryDto) {
    return await this.advancedAnalyticsService.getMarketTrendAnalysis(queryDto);
  }

  @Get('market-trends/:category')
  async getMarketTrendsByCategory(
    @Param('category') category: string,
    @Query() queryDto: MarketTrendQueryDto
  ) {
    return await this.advancedAnalyticsService.getMarketTrendAnalysis({
      ...queryDto,
      category
    });
  }
}
