// Self-contained default implementation of SorobanTraceIngestPort.
//
// This is a stopgap backing store for the replay/backfill machinery until the
// durable Soroban trace store (#712, `SorobanTraceService`) is wired in by
// swapping the `SorobanTraceIngestPort` provider (see soroban-replay.module).
// It is idempotent and keyed on source identity, mirroring the #712 contract
// so the replay semantics (no duplicates, no cursor regression) hold regardless
// of the concrete store.

import { Injectable } from '@nestjs/common';
import { SorobanTraceIngestPort } from './soroban-replay.service';

interface Keyed {
  networkId: string;
  ledgerSeq: number;
  eventIndex: number;
}

@Injectable()
export class InMemoryTraceStore implements SorobanTraceIngestPort {
  private readonly rows = new Map<string, Keyed>();

  private key(input: Keyed): string {
    return `${input.networkId}:${input.ledgerSeq}:${input.eventIndex}`;
  }

  async ingest(input: Parameters<SorobanTraceIngestPort['ingest']>[0]): Promise<{
    inserted: boolean;
  }> {
    const k = this.key(input);
    if (this.rows.has(k)) {
      return { inserted: false };
    }
    this.rows.set(k, {
      networkId: input.networkId,
      ledgerSeq: input.ledgerSeq,
      eventIndex: input.eventIndex,
    });
    return { inserted: true };
  }

  async ledgerHasTraces(networkId: string, ledger: number): Promise<boolean> {
    for (const row of this.rows.values()) {
      if (row.networkId === networkId && row.ledgerSeq === ledger) {
        return true;
      }
    }
    return false;
  }

  get size(): number {
    return this.rows.size;
  }
}
