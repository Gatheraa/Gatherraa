import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('healthz')
  getHealth() {
    return this.healthService.getLiveness();
  }

  @Get('readyz')
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status !== 'ok') {
      response.status(503);
    }

    return readiness;
  }
}
