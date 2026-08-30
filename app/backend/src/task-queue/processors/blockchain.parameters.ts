// Blockchain event job parameter validation.
//
// The blockchain-events queue carries an arbitrary `parameters` payload from
// the HTTP enqueue endpoint to the processor, where each action reads specific
// fields (`fromBlock`, `toBlock`, `transactionHash`, `blockNumber`) with no
// schema. An arbitrary payload can reach the provider layer with missing,
// mistyped, or structurally invalid fields and only fail deep in provider
// code — or worse, silently use a wrong value.
//
// This module is the typed, action-specific validation boundary. It is kept
// pure (no NestJS / provider imports) so it can be unit-tested in isolation,
// and it is invoked at the top of `BlockchainProcessor.process()` before any
// provider call. A payload that fails validation raises a categorized
// `BlockchainParameterError`, which the processor maps to an unrecoverable
// failure so the job is never retried and routes to the Dead Letter Queue.

/** The queue actions and the parameter fields each one consumes. */
export type BlockchainAction = 'listen' | 'process' | 'verify' | 'index';

/** A block reference: a named tag or a numeric/hex block number. */
export type BlockReference = string | number;

/** `listen` action parameters (both fields optional, defaulting to `latest`). */
export interface ListenJobParameters {
  fromBlock?: BlockReference;
  toBlock?: BlockReference;
}

/** `verify` action parameters: a transaction hash is required. */
export interface VerifyJobParameters {
  transactionHash: string;
}

/** `index` action parameters: source identity is required. */
export interface IndexJobParameters {
  transactionHash: string;
  blockNumber: BlockReference;
}

/** `process` action parameters: no provider-facing fields are read. */
export interface ProcessJobParameters {
  [key: string]: unknown;
}

/** Union of the per-action parameter shapes. */
export type BlockchainJobParameters =
  | ListenJobParameters
  | VerifyJobParameters
  | IndexJobParameters
  | ProcessJobParameters;

/**
 * Raised when a job's `parameters` do not match the schema for its action.
 * This is a permanent input failure: retrying the same payload cannot succeed,
 * so the processor maps it to an unrecoverable failure (no retry, DLQ on the
 * first attempt).
 */
export class BlockchainParameterError extends Error {
  readonly code = 'BLOCKCHAIN_PARAMETER_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'BlockchainParameterError';
  }
}

/** Named block tags accepted wherever a block reference is expected. */
const NAMED_BLOCK_TAGS = new Set(['latest', 'earliest', 'pending']);

const HEX_BLOCK_PATTERN = /^0[xX][0-9a-fA-F]+$/;

/**
 * True when `value` is a valid block reference: a named tag, a non-negative
 * integer, or a hex block number.
 */
export function isBlockReference(value: unknown): value is BlockReference {
  if (typeof value === 'string') {
    if (NAMED_BLOCK_TAGS.has(value.toLowerCase())) {
      return true;
    }
    if (HEX_BLOCK_PATTERN.test(value)) {
      return true;
    }
    return false;
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0;
  }
  return false;
}

/**
 * True when `value` is a well-formed EVM transaction hash: a 32-byte hex
 * string (`0x` + 64 hex digits).
 */
export function isTransactionHash(value: unknown): value is string {
  return typeof value === 'string' && /^0[xX][0-9a-fA-F]{64}$/.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireTransactionHash(parameters: Record<string, unknown>): void {
  const hash = parameters.transactionHash;
  if (!isTransactionHash(hash)) {
    throw new BlockchainParameterError(
      `'parameters.transactionHash' must be a 0x-prefixed 32-byte hex string, got: ${describe(hash)}`,
    );
  }
}

/** Human-readable description of a value for an error message (never the raw payload). */
function describe(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  return `typeof ${typeof value}`;
}

/**
 * Validate the `parameters` payload against the schema for `action`.
 *
 * Throws `BlockchainParameterError` for invalid payloads. Returns the
 * parameters narrowed to the action's shape so downstream code reads typed
 * fields.
 */
export function validateBlockchainEventParameters(
  action: BlockchainAction,
  parameters: unknown,
): BlockchainJobParameters {
  if (action === 'process') {
    // `process` reads no provider-facing parameter fields. Tolerate any
    // object payload (or its absence) so existing `process` jobs keep working,
    // but reject structurally unusable payloads that are not plain objects.
    if (parameters !== undefined && parameters !== null && !isPlainObject(parameters)) {
      throw new BlockchainParameterError(
        `action 'process' expects an object 'parameters', got: ${describe(parameters)}`,
      );
    }
    return (parameters ?? {}) as ProcessJobParameters;
  }

  if (!isPlainObject(parameters)) {
    throw new BlockchainParameterError(
      `action '${action}' requires an object 'parameters', got: ${describe(parameters)}`,
    );
  }

  switch (action) {
    case 'listen': {
      const { fromBlock, toBlock } = parameters as ListenJobParameters;
      for (const [name, value] of [
        ['fromBlock', fromBlock],
        ['toBlock', toBlock],
      ] as const) {
        if (value !== undefined && !isBlockReference(value)) {
          throw new BlockchainParameterError(
            `'parameters.${name}' must be a block reference (named tag, hex, or non-negative integer), got: ${describe(value)}`,
          );
        }
      }
      return parameters as ListenJobParameters;
    }
    case 'verify': {
      requireTransactionHash(parameters);
      return parameters as VerifyJobParameters;
    }
    case 'index': {
      requireTransactionHash(parameters);
      if (!isBlockReference(parameters.blockNumber)) {
        throw new BlockchainParameterError(
          `'parameters.blockNumber' must be a block reference (named tag, hex, or non-negative integer), got: ${describe(parameters.blockNumber)}`,
        );
      }
      return parameters as IndexJobParameters;
    }
    default:
      // Reached at runtime only for an action value outside the known set.
      throw new BlockchainParameterError(`Unknown action: ${String(action)}`);
  }
}
