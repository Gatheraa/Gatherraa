import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SorobanTrace } from './entities/soroban-trace.entity';
import { SorobanTraceService } from './soroban-trace.service';

/**
 * Durable Soroban trace store module (issue #712).
 *
 * This is an internal storage module only: it exposes the idempotent,
 * transaction-ordered `SorobanTraceService` for the rest of the M1 pipeline
 * (replay #711 and verification #713) to read from. No REST controller is
 * added here; a public read/query HTTP interface is out of scope (issue #656).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SorobanTrace])],
  providers: [SorobanTraceService],
  exports: [SorobanTraceService],
})
export class SorobanTraceModule {}
