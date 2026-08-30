// Durable, deduplicated, transaction-ordered Soroban trace store (issue #712).
//
// The store treats a write for an already-present source identity as a no-op,
// never an error. A retried job or a concurrent worker writing the same
// transaction produces exactly one row, backed by the real unique index on
// `(transactionHash, ledgerSeq, eventIndex)` created by the
// `003-create-soroban-traces` migration. Reads from a transaction are returned
// in `applicationOrder`, indistinguishable from on-chain emission order.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SorobanTrace } from './entities/soroban-trace.entity';

/** Input for ingesting a single extracted Soroban trace. */
export interface SorobanTraceIngestInput {
  /** Parent transaction hash (source identity component). */
  transactionHash: string;
  /** Ledger sequence the transaction was applied on (identity component). */
  ledgerSeq: number;
  /** Position within the transaction's events array (identity component). */
  eventIndex: number;
  /** Decoded LMS event name, normalized for querying. */
  eventName: string;
  /** Typed event fields, stored normalized (no XDR re-parse needed). */
  eventPayload: Record<string, unknown>;
  /** Raw base64 `DiagnosticEvent` XDR, retained verbatim. */
  rawXdr: string;
  /** Success classification of the enclosing contract call. */
  successfulCall: boolean;
  /** Application (Soroban) order within the transaction. */
  applicationOrder: number;
}

/** Outcome of an idempotent ingest write. */
export interface SorobanTraceIngestResult {
  /** Whether a new row was created (`false` means the identity already existed). */
  inserted: boolean;
  /** The persisted record (newly created, or the pre-existing row). */
  record: SorobanTrace;
}

@Injectable()
export class SorobanTraceService {
  private readonly logger = new Logger(SorobanTraceService.name);

  constructor(
    @InjectRepository(SorobanTrace)
    private readonly traces: Repository<SorobanTrace>,
  ) {}

  /**
   * Idempotently persist a Soroban trace. If a row with the same source
   * identity `(transactionHash, ledgerSeq, eventIndex)` already exists, the
   * write is a no-op: the existing row is returned and `inserted` is `false`.
   * A unique-index violation (from a concurrent worker or a retry) is caught
   * and converted to the same no-op rather than surfacing as an error.
   */
  async ingest(input: SorobanTraceIngestInput): Promise<SorobanTraceIngestResult> {
    const entity = this.traces.create({
      transactionHash: input.transactionHash,
      ledgerSeq: input.ledgerSeq,
      eventIndex: input.eventIndex,
      eventName: input.eventName,
      eventPayload: input.eventPayload,
      rawXdr: input.rawXdr,
      successfulCall: input.successfulCall,
      applicationOrder: input.applicationOrder,
    });

    try {
      const record = await this.traces.save(entity);
      return { inserted: true, record };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.traces.findOne({
          where: {
            transactionHash: input.transactionHash,
            ledgerSeq: input.ledgerSeq,
            eventIndex: input.eventIndex,
          },
        });
        if (existing) {
          return { inserted: false, record: existing };
        }
        throw error;
      }
      throw error;
    }
  }

  /**
   * Return all traces for a transaction strictly in `applicationOrder`
   * (then `eventIndex`), preserving on-chain emission order.
   */
  async findByTransaction(transactionHash: string): Promise<SorobanTrace[]> {
    return this.traces.find({
      where: { transactionHash },
      order: { applicationOrder: 'ASC', eventIndex: 'ASC' },
    });
  }

  /** True when a trace with the given source identity already exists. */
  async exists(input: {
    transactionHash: string;
    ledgerSeq: number;
    eventIndex: number;
  }): Promise<boolean> {
    const count = await this.traces.count({
      where: {
        transactionHash: input.transactionHash,
        ledgerSeq: input.ledgerSeq,
        eventIndex: input.eventIndex,
      },
    });
    return count > 0;
  }
}

/** Recognize a unique-constraint violation across supported drivers. */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const message = String((error as { message?: unknown } | undefined)?.message ?? '');
  return /unique constraint|duplicate|sqlite_constraint|er_dup_entry/i.test(message);
}
