import { Module } from '@nestjs/common';
import { MigrationStatusService } from './migration-status.service';
import { MigrationStatusController } from './migration-status.controller';

@Module({
  providers: [MigrationStatusService],
  controllers: [MigrationStatusController],
  exports: [MigrationStatusService],
})
export class MigrationsModule {}
