// Blockchain event job resource limits
// Bounded resource policy for the blockchain-events queue: oversized payloads
// and oversized batches are rejected at every ingestion entry point so an
// adversarial payload cannot consume worker memory or delay unrelated jobs.

import type { ConfigService } from '@nestjs/config';

export interface BlockchainResourceLimits {
  /** Maximum serialized job payload size in bytes. */
  maxPayloadBytes: number;
  /** Maximum number of events/logs/batch items per job. */
  maxBatchSize: number;
}

/**
 * Safe configuration defaults. Overridable via environment variables
 * BLOCKCHAIN_MAX_PAYLOAD_BYTES and BLOCKCHAIN_MAX_BATCH_SIZE.
 */
export const DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS: BlockchainResourceLimits = {
  maxPayloadBytes: 64 * 1024, // 64 KiB
  maxBatchSize: 100,
};

function parsePositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBlockchainResourceLimits(
  configService: ConfigService,
): BlockchainResourceLimits {
  return {
    maxPayloadBytes: parsePositiveInt(
      configService.get<string>('BLOCKCHAIN_MAX_PAYLOAD_BYTES'),
      DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS.maxPayloadBytes,
    ),
    maxBatchSize: parsePositiveInt(
      configService.get<string>('BLOCKCHAIN_MAX_BATCH_SIZE'),
      DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS.maxBatchSize,
    ),
  };
}

/**
 * Raised when a blockchain event job exceeds the bounded resource policy.
 * Treat this as a permanent input failure: the job must not be retried.
 */
export class BlockchainPayloadLimitError extends Error {
  readonly code = 'BLOCKCHAIN_PAYLOAD_LIMIT_EXCEEDED';

  constructor(message: string) {
    super(message);
    this.name = 'BlockchainPayloadLimitError';
  }
}

/** Fields inside `parameters` that may carry a batch of events/logs. */
const BATCH_FIELDS = ['logs', 'events', 'batch', 'items'] as const;

/**
 * Count the number of events/batch items referenced by a job's parameters.
 * A job can be a single event, an array of events, or carry a batch under a
 * conventional field (logs/events/batch/items).
 */
export function countBatchItems(parameters: unknown): number {
  if (parameters === null || typeof parameters !== 'object') {
    return 0;
  }
  let count = 0;
  if (Array.isArray(parameters)) {
    count = parameters.length;
  }
  const record = parameters as Record<string, unknown>;
  for (const field of BATCH_FIELDS) {
    const value = record[field];
    if (Array.isArray(value)) {
      count = Math.max(count, value.length);
    }
  }
  return count;
}

/**
 * Approximate serialized size of the job payload in UTF-8 bytes.
 * Unserializable payloads are treated as oversized: they cannot be queued or
 * decoded safely.
 */
export function serializedPayloadBytes(data: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(data ?? {}), 'utf8');
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Enforce the bounded resource policy for a blockchain event job.
 * Throws BlockchainPayloadLimitError when the payload exceeds the configured
 * byte limit or the batch exceeds the configured item limit.
 */
export function assertBlockchainEventPayloadWithinLimits(
  data: { parameters?: unknown },
  limits: BlockchainResourceLimits = DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS,
): void {
  const bytes = serializedPayloadBytes(data);
  if (bytes > limits.maxPayloadBytes) {
    throw new BlockchainPayloadLimitError(
      `Blockchain event job payload is ${bytes} bytes, exceeding the limit of ${limits.maxPayloadBytes} bytes`,
    );
  }
  const batchSize = countBatchItems(data?.parameters);
  if (batchSize > limits.maxBatchSize) {
    throw new BlockchainPayloadLimitError(
      `Blockchain event job batch contains ${batchSize} items, exceeding the limit of ${limits.maxBatchSize} items`,
    );
  }
}
