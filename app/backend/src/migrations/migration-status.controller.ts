import { Controller, Get } from '@nestjs/common';
import { MigrationStatusService } from './migration-status.service';

@Controller('migrations')
export class MigrationStatusController {
  constructor(private readonly svc: MigrationStatusService) {}

  @Get('status')
  async status() {
    return this.svc.getStatus();
  }
}
