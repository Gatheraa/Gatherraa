// Soroban replay / backfill module (issue #711).
//
// Wires the durable cursor, the backfill service, and the self-contained
// default trace-store port together, and exposes them for the replay worker.
//
// The Stellar RPC endpoint is read from `STELLAR_RPC` (same envelope as the
// blockchain processor) so the replay worker talks to the same network.

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReplayCursor } from './entities/replay-cursor.entity';
import { ReplayCursorService } from './replay-cursor.service';
import { InMemoryTraceStore } from './in-memory-trace.store';
import { SorobanTraceIngestPort, SorobanReplayService } from './soroban-replay.service';
import { SorobanReplayProcessor } from '../processors/soroban-replay.processor';
import { StellarProvider } from '../providers/stellar.provider';
import { parseStellarRpcConfig } from '../config/blockchain-provider.config';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([ReplayCursor])],
  providers: [
    ReplayCursorService,
    { provide: SorobanTraceIngestPort, useClass: InMemoryTraceStore },
    {
      provide: StellarProvider,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const endpoint = parseStellarRpcConfig(configService.get<string>('STELLAR_RPC'));
        if (!endpoint) {
          return null;
        }
        return new StellarProvider(endpoint);
      },
    },
    SorobanReplayService,
    SorobanReplayProcessor,
  ],
  exports: [SorobanTraceIngestPort, SorobanReplayService, StellarProvider],
})
export class SorobanReplayModule {}
