// Decode error retry classification (issue #714).
//
// The blockchain-events worker previously treated every thrown `Error` the same
// way: retry the job up to `opts.attempts`, then route it to the Dead Letter
// Queue. That is wrong on both sides of the spectrum:
//
//   - A malformed/unsupported/ungated decode input is *permanent*: retrying the
//     same input can only fail again, so a single poisoned event occupies a
//     bounded worker concurrency slot across pointless retries and can stall
//     unrelated jobs behind it.
//   - A not-yet-confirmed transaction is *transient*: it can succeed after
//     confirmation, so exhausting attempts and DLQ'ing it early strands a
//     legitimate event.
//
// This module is the retry classification boundary. It maps each decode
// outcome to a retry policy, and the processor (`BlockchainProcessor.process`)
// routes permanent decode outcomes to the Dead Letter Queue on the FIRST
// failure (via `UnrecoverableError`), while transient outcomes keep the plain
// `Error` shape so the existing attempts machinery (and never-DLQ-until-
// exhausted semantics) applies unchanged.

/** Decode outcome codes carried by the worker's decode path. */
export type DecodeErrorCode =
  | 'InvalidBase64'
  | 'TruncatedXdr'
  | 'MalformedXdr'
  | 'UnsupportedEvent'
  | 'UnexpectedContractId'
  | 'InvalidPayload';

/**
 * Decode outcomes that can never succeed given the same input. Every one of
 * these is a permanent input/policy failure:
 *
 * - `InvalidBase64` — the input is not valid base64.
 * - `TruncatedXdr` — the XDR ends before the event is complete.
 * - `MalformedXdr` — the XDR is not a structurally valid Soroban `DiagnosticEvent`.
 * - `UnsupportedEvent` — valid XDR, but not an LMS contract event.
 * - `UnexpectedContractId` — the emitter does not match the expected deployment.
 * - `InvalidPayload` — the event fields do not match the documented representation.
 *
 * The issue's taxonomy names `InvalidBase64`, `MalformedXdr`, `UnsupportedEvent`,
 * and `InvalidPayload` as permanent; `TruncatedXdr` and `UnexpectedContractId`
 * are classified permanent for the same reason — the identical input always
 * produces the identical failure.
 */
export const PERMANENT_DECODE_ERRORS: ReadonlySet<DecodeErrorCode> = new Set([
  'InvalidBase64',
  'TruncatedXdr',
  'MalformedXdr',
  'UnsupportedEvent',
  'UnexpectedContractId',
  'InvalidPayload',
]);

/**
 * Raised by the worker's decode path for a rejected input. Carries the
 * categorized `code` (never the offending input) so the catch block can make a
 * retry decision without leaking payload data.
 */
export class SorobanEventDecodeError extends Error {
  readonly code: DecodeErrorCode;

  constructor(code: DecodeErrorCode) {
    super(decodeErrorMessage(code));
    this.name = 'SorobanEventDecodeError';
    this.code = code;
  }
}

/** Human-readable message for a decode outcome code (never the raw input). */
export function decodeErrorMessage(code: DecodeErrorCode): string {
  switch (code) {
    case 'InvalidBase64':
      return 'Decode failed: input is not valid base64.';
    case 'TruncatedXdr':
      return 'Decode failed: XDR is truncated before the event is complete.';
    case 'MalformedXdr':
      return 'Decode failed: XDR is not a structurally valid Soroban DiagnosticEvent.';
    case 'UnsupportedEvent':
      return 'Decode failed: valid XDR, but not an LMS contract event.';
    case 'UnexpectedContractId':
      return 'Decode failed: event emitter does not match the expected deployment.';
    case 'InvalidPayload':
      return 'Decode failed: event fields do not match the documented LMS representation.';
  }
}

/**
 * True when `error` is a permanent decode failure that must reach the Dead
 * Letter Queue on the first attempt, never consuming retries.
 */
export function isPermanentDecodeError(error: unknown): boolean {
  return error instanceof SorobanEventDecodeError && PERMANENT_DECODE_ERRORS.has(error.code);
}

/** Retry policy associated with a decode outcome, for operator documentation and tests. */
export function decodeRetryPolicy(code: DecodeErrorCode): {
  retryable: boolean;
  onFirstFailure: 'dlq' | 'retry';
} {
  if (PERMANENT_DECODE_ERRORS.has(code)) {
    return { retryable: false, onFirstFailure: 'dlq' };
  }
  return { retryable: true, onFirstFailure: 'retry' };
}
