import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DataVisualizationService } from '../services/data-visualization.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('analytics/visualization')
@UseGuards(JwtAuthGuard)
export class DataVisualizationController {
  constructor(private readonly dataVisualizationService: DataVisualizationService) {}

  @Get('dashboard')
  async getDashboardCharts(@Query('timePeriod') timePeriod?: string) {
    return await this.dataVisualizationService.getDashboardChartData(timePeriod);
  }

  @Get('heatmap')
  async getActivityHeatmap(@Query('timePeriod') timePeriod?: string) {
    return await this.dataVisualizationService.getActivityHeatmap(timePeriod);
  }

  @Get('realtime')
  async getRealTimeCharts() {
    return await this.dataVisualizationService.getRealTimeChartData();
  }
}
