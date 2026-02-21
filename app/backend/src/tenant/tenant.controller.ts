import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Request } from 'express';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('onboard')
  async onboardTenant(@Body() body: { name: string; domain?: string }) {
    const tenant = await this.tenantService.createTenant(body.name, body.domain);
    return { message: 'Tenant created', tenant };
  }

  @Get('config')
  async getConfig(@Req() req: Request) {
    const tenantId = req['tenantId'];
    const config = await this.tenantService.getTenantConfig(tenantId);
    return { tenantId, config };
  }
}