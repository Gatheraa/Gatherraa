// Soroban verification service (issue #713).
//
// Verifies a Soroban transaction on demand: fetch it via the Stellar provider,
// categorize the confirmation state (SUCCESS / FAILED / not-yet-found), and
// prove that the decoded event it is expected to have emitted is still present
// with equal business fields. Every outcome is persisted durably, keyed by
// transaction hash, so the fact survives a restart and re-verification updates
// the same row instead of duplicating it.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SorobanVerificationOutcome,
  SorobanVerificationRecord,
} from './entities/soroban-verification.entity';
import {
  SorobanTransactionResult,
  SorobanEventRecord,
  StellarProvider,
} from '../task-queue/providers/stellar.provider';

/**
 * Raised when a Soroban transaction has not been found (or not yet confirmed).
 * This is a transient outcome: the same job can succeed after confirmation, so
 * it must go through the ordinary retry machinery and never reach the DLQ on
 * the first attempt.
 */
export class SorobanTransactionNotFoundError extends Error {
  readonly code = 'SOROBAN_TRANSACTION_NOT_FOUND';

  constructor(transactionHash: string) {
    super(`Soroban transaction ${transactionHash} not found (or not yet confirmed).`);
    this.name = 'SorobanTransactionNotFoundError';
  }
}

/** Inputs required to verify a Soroban transaction on demand. */
export interface SorobanVerificationInput {
  provider: StellarProvider | null;
  transactionHash: string;
  eventName?: string | null;
  contractId?: string | null;
  /** Business fields the event is expected to have carried. */
  expectedPayload?: unknown;
}

/** Categorized, durably-persisted verification outcome. */
export interface SorobanVerificationResult {
  transactionHash: string;
  outcome: SorobanVerificationOutcome;
  verified: boolean;
  ledgerSeq?: number;
  eventName?: string | null;
  detail?: string;
}

/**
 * True when `a` and `b` represent the same normalized payload. Plain objects
 * are compared key-for-key (order-insensitive); primitives compare by value;
 * otherwise equality falls back to a canonical JSON serialization.
 */
export function sorobanPayloadsEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a) || Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((key) => sorobanPayloadsEqual(aObj[key], bObj[key]));
  }
  return String(a) === String(b);
}

@Injectable()
export class SorobanVerificationService {
  constructor(
    @InjectRepository(SorobanVerificationRecord)
    private readonly repo: Repository<SorobanVerificationRecord>,
  ) {}

  /**
   * Verify whether a Soroban transaction actually emitted the expected event
   * with equal business fields.
   *
   * Throws `SorobanTransactionNotFoundError` for a not-yet-confirmed
   * transaction (transient). Every other outcome is persisted and returned.
   */
  async verify(input: SorobanVerificationInput): Promise<SorobanVerificationResult> {
    if (!input.provider) {
      throw new Error(
        'Provider not configured for network stellar: cannot verify a Soroban transaction.',
      );
    }

    const result = await this.fetchOrThrow(input);
    return this.classifyAndPersist(input, result);
  }

  /** Fetch and translate transport/HTTP failures into a retryable outcome. */
  private async fetchOrThrow(input: SorobanVerificationInput): Promise<SorobanTransactionResult> {
    try {
      const result = await input.provider!.getTransaction(input.transactionHash);
      // A valid RPC response with no result yet is transient, never DLQ'd early.
      if (result.status === 'NOT_FOUND') {
        throw new SorobanTransactionNotFoundError(input.transactionHash);
      }
      return result;
    } catch (error) {
      if (error instanceof SorobanTransactionNotFoundError) {
        throw error;
      }
      // Transport hiccups (network, 5xx) are also transient.
      throw new SorobanTransactionNotFoundError(input.transactionHash);
    }
  }

  /** Turn a fetched, found transaction into a categorized durable outcome. */
  private async classifyAndPersist(
    input: SorobanVerificationInput,
    result: SorobanTransactionResult,
  ): Promise<SorobanVerificationResult> {
    if (result.status === 'FAILED') {
      return this.persist({
        transactionHash: input.transactionHash,
        outcome: SorobanVerificationOutcome.REVERTED,
        verified: false,
        ledgerSeq: result.ledgerSeq,
        eventName: input.eventName,
        detail: result.resultCode ? `resultCode=${result.resultCode}` : undefined,
      });
    }

    // SUCCESS: the expected event must be present with equal business fields.
    const match = this.findExpectedEvent(result.events, input);
    if (match) {
      return this.persist({
        transactionHash: input.transactionHash,
        outcome: SorobanVerificationOutcome.VERIFIED,
        verified: true,
        ledgerSeq: result.ledgerSeq,
        eventName: match.event.eventName ?? input.eventName ?? null,
      });
    }

    return this.persist({
      transactionHash: input.transactionHash,
      outcome: SorobanVerificationOutcome.MISMATCH,
      verified: false,
      ledgerSeq: result.ledgerSeq,
      eventName: input.eventName,
      detail:
        'The confirmed transaction does not contain the expected event with equal business fields.',
    });
  }

  /** Locate an event matching the expected identity and payload, if any. */
  private findExpectedEvent(
    events: SorobanEventRecord[],
    input: SorobanVerificationInput,
  ): { event: SorobanEventRecord } | null {
    for (const event of events) {
      const nameMatches =
        input.eventName === undefined ||
        input.eventName === null ||
        (event.eventName !== null && event.eventName === input.eventName);
      if (!nameMatches) {
        continue;
      }
      if (input.contractId && event.contractId && event.contractId !== input.contractId) {
        continue;
      }
      if (
        input.expectedPayload !== undefined &&
        !sorobanPayloadsEqual(event.payload, input.expectedPayload)
      ) {
        continue;
      }
      return { event };
    }
    return null;
  }

  /** Upsert the outcome; a present row for `transactionHash` is updated, not duplicated. */
  private async persist(effect: SorobanVerificationResult): Promise<SorobanVerificationResult> {
    const existing = await this.repo.findOne({
      where: { transactionHash: effect.transactionHash },
    });
    if (existing) {
      existing.outcome = effect.outcome;
      existing.verified = effect.verified;
      existing.ledgerSeq = effect.ledgerSeq;
      existing.eventName = effect.eventName ?? null;
      existing.detail = effect.detail ?? null;
      await this.repo.save(existing);
      return effect;
    }
    const record = this.repo.create({
      transactionHash: effect.transactionHash,
      outcome: effect.outcome,
      verified: effect.verified,
      ledgerSeq: effect.ledgerSeq,
      eventName: effect.eventName ?? null,
      detail: effect.detail ?? null,
    });
    await this.repo.save(record);
    return effect;
  }
}
