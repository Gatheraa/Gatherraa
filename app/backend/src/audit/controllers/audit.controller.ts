import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../services/audit.service';
// import { RolesGuard } from '../../auth/guards/roles.guard';
// import { Roles } from '../../auth/decorators/roles.decorator';
// import { UserRole } from '../../users/entities/user.entity';

@Controller('audit')
// @UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  // @Roles(UserRole.ADMIN)
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entityName') entityName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditService.getLogs({
      userId,
      action,
      entityName,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id/verify')
  // @Roles(UserRole.ADMIN)
  async verifyLog(@Param('id') id: string) {
    const isValid = await this.auditService.verifyLogIntegrity(id);
    return { id, isValid };
  }

  @Get('report/compliance')
  // @Roles(UserRole.ADMIN)
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    // Basic compliance report logic
    const { logs, total } = await this.auditService.getLogs({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      limit: 1000,
    });

    const summary = {
      totalEvents: total,
      byAction: {},
      byEntity: {},
      period: { startDate, endDate },
      generatedAt: new Date().toISOString(),
    };

    logs.forEach(log => {
      summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
      if (log.entityName) {
        summary.byEntity[log.entityName] = (summary.byEntity[log.entityName] || 0) + 1;
      }
    });

    return { summary, logs };
  }
}
