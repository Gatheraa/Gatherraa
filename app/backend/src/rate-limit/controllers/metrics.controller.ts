import { Controller, Get, Header } from '@nestjs/common';
import { RateLimitMetricsService } from '../services/rate-limit-metrics.service';
import { SkipRateLimit } from '../rate-limit.decorator';

@Controller('metrics')
@SkipRateLimit()
export class MetricsController {
  constructor(private readonly metricsService: RateLimitMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(): string {
    return this.metricsService.getMetricsAsPrometheusText();
  }
}
