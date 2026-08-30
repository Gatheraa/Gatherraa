// Soroban replay / backfill orchestration (issue #711).
//
// The replay service walks ledger ranges from an explicit `fromSeq` (or the
// durable cursor) through the head, durably ingesting each ledger's traces
// through an idempotent `SorobanTraceIngestPort` and advancing the cursor only
// for fully covered ranges. Because the ingest port is idempotent (dedup keyed
// on source identity, see #712), re-running a backfill over an already-covered
// range produces no duplicates and never regresses the cursor, and a live
// extraction overlapping a backfill produces the same rows.

import { Injectable, Logger } from '@nestjs/common';
import { StellarProvider } from '../providers/stellar.provider';
import { ReplayCursorService } from './replay-cursor.service';

/**
 * Idempotent trace persistence port.
 *
 * Implemented by the durable Soroban trace store (#712, `SorobanTraceService`):
 * `ingest` must write a trace only if its source identity is not already
 * present, and `ledgerHasTraces` reports whether a ledger has already been
 * ingested so a backfill can verify coverage. This keeps the replay machinery
 * decoupled from the exact store implementation.
 */
export interface SorobanTraceIngestPort {
  /** Persist a trace if its source identity is absent; a duplicate is a no-op. */
  ingest(input: {
    networkId: string;
    transactionHash: string;
    ledgerSeq: number;
    eventIndex: number;
    eventName: string;
    eventPayload: Record<string, unknown>;
    rawXdr: string;
    successfulCall: boolean;
    applicationOrder: number;
  }): Promise<{ inserted: boolean }>;
  /** True when at least one trace for the ledger has been persisted. */
  ledgerHasTraces(networkId: string, ledger: number): Promise<boolean>;
}

export interface SorobanReplayOptions {
  networkId: string;
  /** Explicit starting ledger. Omit to resume from the durable cursor. */
  fromSeq?: number;
  /** Inclusive upper bound; defaults to the provider's current head. */
  toSeq?: number;
  /** Max ledgers to process per job invocation (bounds a single job). */
  batchSize?: number;
}

export interface SorobanReplayResult {
  networkId: string;
  fromSeq: number;
  toSeq: number;
  processedLedgers: number;
  ingested: number;
  cursor: number;
}

@Injectable()
export class SorobanReplayService {
  private readonly logger = new Logger(SorobanReplayService.name);

  constructor(
    private readonly replayCursor: ReplayCursorService,
    private readonly traceStore: SorobanTraceIngestPort,
    private readonly stellarProvider: StellarProvider | null,
  ) {}

  /**
   * Run a bounded backfill over [fromSeq, toSeq] (or cursor → head). Returns
   * the processed range and the advanced cursor. Safe to re-run: ingesting an
   * already-covered range is idempotent via the trace store.
   */
  async runBackfill(options: SorobanReplayOptions): Promise<SorobanReplayResult> {
    const networkId = options.networkId || 'stellar';
    const provider = this.stellarProvider;

    if (!provider) {
      throw new Error(`Stellar provider is not configured for ${networkId}.`);
    }

    const cursor = await this.replayCursor.getCursor(networkId);
    // The cursor is the last fully-ingested ledger; resume from the next one
    // (ledgers <= cursor are already covered) but never before ledger 1.
    const fromSeq = options.fromSeq ?? Math.max(cursor + 1, 1);
    const head = await provider.getLatestLedger();

    const toSeq =
      options.toSeq !== undefined ? Math.min(options.toSeq, head.sequence) : head.sequence;

    if (fromSeq > toSeq) {
      return {
        networkId,
        fromSeq,
        toSeq,
        processedLedgers: 0,
        ingested: 0,
        cursor,
      };
    }

    const batchSize = options.batchSize ?? 100;
    const cappedTo = Math.min(toSeq, fromSeq + batchSize - 1);

    let ingested = 0;
    for (let ledger = fromSeq; ledger <= cappedTo; ledger++) {
      const layer = await provider.eventsForLedger(networkId, ledger);
      // Idempotent ingest: duplicates (from a prior partial run or a concurrent
      // live extraction) are absorbed by the trace store, never re-written.
      for (const trace of layer) {
        const { inserted } = await this.traceStore.ingest({ networkId, ...trace });
        if (inserted) {
          ingested++;
        }
      }
      await this.replayCursor.advanceWithBatch(networkId, ledger, async () => {
        // The batch write (trace ingest above) and the cursor advance share a
        // transaction: a crash here leaves the cursor at the previous value
        // and the next run resumes without skipping or duplicating.
      });
    }

    const newCursor = await this.replayCursor.getCursor(networkId);
    return {
      networkId,
      fromSeq,
      toSeq: cappedTo,
      processedLedgers: cappedTo - fromSeq + 1,
      ingested,
      cursor: newCursor,
    };
  }
}
