// Blockchain Event Job Processor
// Handles blockchain event processing and contract interactions

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TaskQueueService } from '../services/task-queue.service';
import {
  assertBlockchainEventPayloadWithinLimits,
  BlockchainPayloadLimitError,
  BlockchainResourceLimits,
  getBlockchainResourceLimits,
} from './blockchain.validation';
import {
  BlockchainAction,
  BlockchainParameterError,
  validateBlockchainEventParameters,
} from './blockchain.parameters';
import {
  resolveStellarProviderConfig,
  StellarConfigError,
  STELLAR_NETWORK_ID,
} from '../config/blockchain-provider.config';
import {
  SorobanTransactionEvent,
  StellarProvider,
  StellarGetTransactionStatus,
} from '../providers/stellar.provider';

export interface BlockchainEventJobData {
  contractAddress: string;
  eventName: string;
  parameters: any;
  networkId?: string;
  rpcUrl?: string;
  action?: 'listen' | 'process' | 'verify' | 'index' | 'soroban-trace';
}

/**
 * A single decoded Soroban trace record produced by the soroban-trace action.
 *
 * This is the typed, serializable envelope the rest of M1 (persistence,
 * replay, re-verification) consumes. It carries the typed event representation
 * plus the raw wire entry, the parent transaction hash, and the ledger sequence
 * so downstream stages never re-derive the envelope. The Rust `LmsEvent`
 * remains the canonical typed payload for events known to the LMS contract.
 */
export interface SorobanTraceRecord {
  /** Typed representation of the Soroban event. */
  event: SorobanTransactionEvent;
  /** Raw base64 event entry from the RPC (stringified), never lossy. */
  rawXdr: string;
  /** Parent transaction hash. */
  transactionHash: string;
  /** Ledger sequence the transaction was applied on. */
  ledger: number;
  /** Application (Soroban) order of the transaction. */
  applicationOrder?: number;
}

/**
 * Raised when a Soroban event entry cannot be trusted for ingestion: an
 * invalid base64 payload or a structurally unusable entry. Treat this as a
 * permanent input failure — the raw wire data cannot be repaired by retrying.
 */
export class SorobanTraceDecodeError extends Error {
  readonly code = 'SOROBAN_TRACE_DECODE_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'SorobanTraceDecodeError';
  }
}

// --- Canonical event identity ----------------------------------------------
// An EVM event's canonical identity is its signature topic (topics[0]), the
// Keccak-256 hash of the event signature. Matching must be exact: substring
// matching over encoded topics can collide, letting unrelated logs be accepted
// or valid events be rejected.

const HEX_TOPIC_PATTERN = /^0[xX][0-9a-fA-F]{64}$/;

/**
 * Strict base64 validation (standard alphabet, optional padding): the payload
 * must re-encode to exactly the original string. This rejects truncated or
 * garbage payloads that `Buffer.from` would otherwise silently accept.
 */
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function isValidBase64(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || !BASE64_PATTERN.test(value)) {
    return false;
  }
  try {
    const decoded = Buffer.from(value, 'base64').toString('base64');
    return decoded === value;
  } catch {
    return false;
  }
}

/**
 * Resolve a job's eventName to its canonical (lowercase) event identity topic.
 * Accepts an already-encoded 32-byte topic or a full event signature such as
 * "Transfer(address,address,uint256)". Bare event names cannot be canonicalized
 * and resolve to null rather than falling back to unsafe substring matching.
 */
export function canonicalEventTopic(eventName: string): string | null {
  if (typeof eventName !== 'string' || eventName.trim().length === 0) {
    return null;
  }
  const trimmed = eventName.trim();
  if (HEX_TOPIC_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (!trimmed.includes('(')) {
    return null;
  }
  try {
    return ethers.utils.id(trimmed).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Case-safe address comparison. Non-string or empty inputs never match,
 * keeping malformed data deterministic instead of throwing.
 */
export function isSameAddress(a: unknown, b: unknown): boolean {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    a.length > 0 &&
    b.length > 0 &&
    a.toLowerCase() === b.toLowerCase()
  );
}

/**
 * Exact canonical event matching: a log matches only when its signature topic
 * (topics[0]) equals the canonical event identity. Malformed logs (missing
 * topics, empty topics, or non-string signature topics) deterministically do
 * not match.
 */
export function isEventLogFor(log: unknown, eventName: string): boolean {
  const expectedTopic = canonicalEventTopic(eventName);
  if (expectedTopic === null || log === null || typeof log !== 'object') {
    return false;
  }
  const topics = (log as { topics?: unknown }).topics;
  if (!Array.isArray(topics) || topics.length === 0) {
    return false;
  }
  const signatureTopic = topics[0];
  return typeof signatureTopic === 'string' && signatureTopic.toLowerCase() === expectedTopic;
}

/**
 * Processor for blockchain event jobs
 * Handles event listening, processing, and contract interactions
 */
@Processor('blockchain-events', { concurrency: 5 })
@Injectable()
export class BlockchainProcessor extends WorkerHost {
  private readonly logger = new Logger(BlockchainProcessor.name);
  private providers: Map<string, ethers.providers.Provider> = new Map();
  private stellarProvider: StellarProvider | null = null;
  private readonly limits: BlockchainResourceLimits;

  constructor(
    private configService: ConfigService,
    private readonly taskQueueService: TaskQueueService,
  ) {
    super();
    this.limits = getBlockchainResourceLimits(configService);
    this.initializeProviders();
  }

  /**
   * Initialize blockchain providers for different networks
   */
  private initializeProviders() {
    // Ethereum Mainnet
    const mainnetRpc = this.configService.get<string>('ETH_MAINNET_RPC');
    if (mainnetRpc) {
      this.providers.set('1', new ethers.providers.JsonRpcProvider(mainnetRpc));
    }

    // Sepolia Testnet
    const sepoliaRpc = this.configService.get<string>('ETH_SEPOLIA_RPC');
    if (sepoliaRpc) {
      this.providers.set('11155111', new ethers.providers.JsonRpcProvider(sepoliaRpc));
    }

    // Polygon
    const polygonRpc = this.configService.get<string>('POLYGON_RPC');
    if (polygonRpc) {
      this.providers.set('137', new ethers.providers.JsonRpcProvider(polygonRpc));
    }

    // Stellar is NOT an EVM network and must never be built on ethers. It uses
    // the Stellar (Soroban) protocol, so it is handled by a dedicated
    // protocol-compatible client. Invalid STELLAR_RPC configuration fails
    // clearly here instead of appearing healthy, and the endpoint is never
    // logged.
    const stellarRpc = this.configService.get<string>('STELLAR_RPC');
    try {
      const stellarConfig = resolveStellarProviderConfig(stellarRpc);
      if (stellarConfig) {
        this.stellarProvider = new StellarProvider(stellarConfig.endpoint);
        this.logger.log(`Initialized Stellar provider for ${stellarConfig.safeEndpoint}`);
      }
    } catch (error) {
      if (error instanceof StellarConfigError) {
        this.logger.error(`Failed to initialize Stellar provider: ${error.message}`);
        throw error;
      }
      throw error;
    }

    this.logger.log(`Initialized ${this.providers.size} blockchain providers`);
  }

  /**
   * Process blockchain event job
   */
  async process(job: Job<BlockchainEventJobData>) {
    const jobId = job.id;
    const {
      contractAddress,
      eventName,
      parameters,
      networkId = '1',
      action = 'process',
    } = job.data;

    try {
      // Bounded resource policy: reject oversized payloads before any decoding
      // work. These are permanent input failures and are never retried.
      assertBlockchainEventPayloadWithinLimits(job.data, this.limits);

      // Typed, action-specific parameter validation. An arbitrary `parameters`
      // payload cannot reach the provider layer: missing, mistyped, or
      // structurally invalid fields (and unknown actions) are rejected here as
      // permanent failures, before any provider call. The catch block maps
      // these to an unrecoverable failure, so the job is never retried and
      // routes to the DLQ on the first attempt.
      //
      // `soroban-trace` is exempt: it is a Stellar-only action whose guard and
      // failure classification live in the Stellar branch below (permanent
      // payload-limit/decode failures vs transient not-yet-confirmed states).
      if (action !== 'soroban-trace') {
        validateBlockchainEventParameters(action as BlockchainAction, parameters);
      }

      this.logger.log(
        `Processing blockchain event job ${jobId}: ${eventName} on network ${networkId}`,
      );

      await job.updateProgress(10);

      // Get provider for network
      const provider = this.getProvider(networkId);
      if (!provider) {
        throw new Error(`Provider not configured for network ${networkId}`);
      }

      if (networkId === STELLAR_NETWORK_ID) {
        // Stellar uses the Soroban protocol; the EVM action handlers do not
        // apply. Only the dedicated Soroban extraction action is valid here;
        // anything else fails clearly instead of silently executing EVM
        // JSON-RPC against a Stellar endpoint.
        if (action !== 'soroban-trace') {
          throw new Error(
            `Action '${action}' is not supported on the ${STELLAR_NETWORK_ID} network. ` +
              `Stellar uses the Soroban protocol, not EVM JSON-RPC.`,
          );
        }
        const stellarResult = await this.extractSorobanTrace(
          this.stellarProvider,
          contractAddress,
          parameters,
          job,
        );
        await job.updateProgress(100);
        this.logger.log(`Blockchain event job ${jobId} completed successfully`);
        return {
          success: true,
          action,
          eventName,
          networkId,
          contractAddress,
          result: stellarResult,
          timestamp: new Date(),
        };
      }

      await job.updateProgress(25);

      // Route to appropriate action
      let result;
      switch (action) {
        case 'listen':
          result = await this.listenToEvent(
            provider as ethers.providers.Provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'process':
          result = await this.processEvent(
            provider as ethers.providers.Provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'verify':
          result = await this.verifyEvent(
            provider as ethers.providers.Provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'index':
          result = await this.indexEvent(
            provider as ethers.providers.Provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      await job.updateProgress(100);

      this.logger.log(`Blockchain event job ${jobId} completed successfully`);

      return {
        success: true,
        action,
        eventName,
        networkId,
        contractAddress,
        result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to process blockchain event job ${jobId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof BlockchainPayloadLimitError) {
        // Permanent input failure: fail the job immediately without retries.
        // onJobFailed routes it to the Dead Letter Queue.
        throw new UnrecoverableError(error.message);
      }

if (error instanceof BlockchainParameterError) {
        // Permanent input failure: the payload can never become a valid job
        // for this action, so retrying cannot help. onJobFailed routes it to
        // the Dead Letter Queue on the first attempt.
        throw new UnrecoverableError(error.message);
      }

      if (error instanceof SorobanTraceDecodeError) {
        // A malformed Soroban event entry is a permanent input failure: the
        // raw wire data cannot be trusted and retrying will not repair it.
        throw new UnrecoverableError(error.message);
      }

      throw {
        message: error.message,
        code: error.code,
        networkId,
        contractAddress,
        eventName,
        originalError: error,
      };
    }
  }

  /**
   * Listen to blockchain events
   */
  private async listenToEvent(
    provider: ethers.providers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(`Setting up event listener for ${eventName} on ${contractAddress}`);

    await job.updateProgress(50);

    // Create event filter
    const filter = {
      address: contractAddress,
      topics: [eventName],
    };

    // Fetch recent logs
    const logs = await provider.getLogs({
      ...filter,
      fromBlock: parameters.fromBlock || 'latest',
      toBlock: parameters.toBlock || 'latest',
    });

    await job.updateProgress(75);

    this.logger.log(`Found ${logs.length} matching events`);

    return {
      eventCount: logs.length,
      logs: logs.slice(0, 10), // Return first 10 for details
      lastBlockNumber: logs[0]?.blockNumber || 0,
    };
  }

  /**
   * Process a blockchain event
   */
  private async processEvent(
    provider: ethers.providers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(`Processing event ${eventName} with parameters`, parameters);

    await job.updateProgress(50);

    // Validate contract address
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
      throw new Error(`No contract found at ${contractAddress}`);
    }

    await job.updateProgress(75);

    // Process event data
    const result = {
      processed: true,
      contractAddress,
      eventName,
      parameters,
      processedAt: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Verify a blockchain event
   */
  private async verifyEvent(
    provider: ethers.providers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(`Verifying event ${eventName}`);

    await job.updateProgress(50);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(parameters.transactionHash);

    if (!receipt) {
      throw new Error(`Transaction ${parameters.transactionHash} not found`);
    }

    await job.updateProgress(75);

    // Verify the event was emitted using canonical exact event identity:
    // the signature topic (topics[0]) must match exactly, and the contract
    // address comparison stays case-safe. Malformed logs never match.
    const eventFound = receipt.logs.some((log) => {
      if (log === null || typeof log !== 'object') {
        return false;
      }
      return (
        isSameAddress((log as { address?: unknown }).address, contractAddress) &&
        isEventLogFor(log, eventName)
      );
    });

    return {
      verified: eventFound,
      transactionHash: parameters.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
    };
  }

  /**
   * Index blockchain event for search/query
   */
  private async indexEvent(
    provider: ethers.providers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(`Indexing event ${eventName}`);

    await job.updateProgress(50);

    // This is where you would send the event to an indexing service
    // e.g., The Graph, Elasticsearch, or your own indexing service

    const indexData = {
      contractAddress,
      eventName,
      parameters,
      indexedAt: new Date().toISOString(),
      blockNumber: parameters.blockNumber,
      transactionHash: parameters.transactionHash,
    };

    // TODO: Send to indexing service
    this.logger.log(`Event indexed:`, indexData);

    await job.updateProgress(100);

    return {
      indexed: true,
      indexData,
    };
  }

  /**
   * Extract Soroban traces from a Stellar (Soroban) transaction.
   *
   * This is the M1 ingest step: fetch the transaction for
   * `parameters.transactionHash`, apply the bounded resource policy to the raw
   * `events[]` array, and emit one typed trace record per event.
   *
   * A transaction that is not yet confirmed or unknown (`notFound`,
   * `tryAgainLater`, `duplicate`) is a transient, retryable condition and is
   * reported as a normal error — `onJobFailed` only routes it to the DLQ after
   * attempts are exhausted, never on the first failure. A request that exceeds
   * the configured events/byte budget or carries a malformed base64 entry is a
   * permanent input failure routed to the DLQ.
   */
  private async extractSorobanTrace(
    stellarProvider: StellarProvider | null,
    contractAddress: string,
    parameters: any,
    job: Job,
  ): Promise<{ traces: SorobanTraceRecord[] }> {
    const transactionHash = parameters?.transactionHash;
    if (typeof transactionHash !== 'string' || transactionHash.trim().length === 0) {
      throw new SorobanTraceDecodeError(
        'Soroban trace extraction requires a parameters.transactionHash string.',
      );
    }

    if (!stellarProvider) {
      throw new Error(`Stellar provider is not configured for the ${STELLAR_NETWORK_ID} network.`);
    }

    await job.updateProgress(30);

    const tx = await stellarProvider.getTransaction(transactionHash);

    // Not-yet-confirmed or unknown transactions (and duplicate/try-again
    // conditions) are transient: retry instead of the DLQ.
    const retryable: StellarGetTransactionStatus[] = ['notFound', 'tryAgainLater', 'duplicate'];
    if (!tx.ok) {
      if (retryable.includes(tx.status)) {
        throw new Error(
          `Soroban transaction ${transactionHash} is not available yet (${tx.status}).`,
        );
      }
      throw new Error(`Soroban getTransaction failed (${tx.status}) for ${transactionHash}.`);
    }

    await job.updateProgress(55);

    // A failed transaction still carries diagnostic events; the trace records
    // preserve the `inSuccessfulContractCall` signal so downstream stages can
    // filter or retain them as they see fit.
    const events = tx.events;

    // Soroban-appropriate budget re-check on the raw events[] array: bound the
    // batch size and the total encoded byte volume before decoding the batch.
    this.assertSorobanTraceBudget(events);

    await job.updateProgress(75);

    const traces: SorobanTraceRecord[] = events.map((event) => {
      this.assertValidBase64(event, transactionHash);
      return {
        event,
        rawXdr: JSON.stringify(event),
        transactionHash,
        ledger: tx.ledger ?? 0,
        applicationOrder: tx.applicationOrder,
      };
    });

    await job.updateProgress(100);

    return { traces };
  }

  /**
   * Apply a Soroban-appropriate resource budget to the raw events[] array: the
   * batch must not exceed the configured item limit, and the total encoded
   * byte volume must not exceed the configured payload budget. Over-budget
   * requests are a permanent `BlockchainPayloadLimitError` → DLQ.
   */
  private assertSorobanTraceBudget(events: SorobanTransactionEvent[]): void {
    if (events.length > this.limits.maxBatchSize) {
      throw new BlockchainPayloadLimitError(
        `Soroban transaction carries ${events.length} events, exceeding the limit ` +
          `of ${this.limits.maxBatchSize} events`,
      );
    }

    let totalBytes = 0;
    for (const event of events) {
      totalBytes += Buffer.byteLength(JSON.stringify(event), 'utf8');
    }
    if (totalBytes > this.limits.maxPayloadBytes) {
      throw new BlockchainPayloadLimitError(
        `Soroban transaction events total ${totalBytes} bytes, exceeding the limit ` +
          `of ${this.limits.maxPayloadBytes} bytes`,
      );
    }
  }

  /**
   * Validate that a Soroban event entry's base64 payloads are well-formed.
   * A structurally unusable entry (missing topics/value or invalid base64) is a
   * permanent, non-retryable input failure — the raw wire data cannot be
   * trusted and retrying will not repair it.
   */
  private assertValidBase64(event: SorobanTransactionEvent, transactionHash: string): void {
    if (!Array.isArray(event.topic) || typeof event.value !== 'string') {
      throw new SorobanTraceDecodeError(
        `Soroban event in transaction ${transactionHash} is not a usable event entry.`,
      );
    }
    for (const item of event.topic) {
      if (!isValidBase64(item)) {
        throw new SorobanTraceDecodeError(
          `Soroban event topic in transaction ${transactionHash} is not valid base64.`,
        );
      }
    }
    if (!isValidBase64(event.value)) {
      throw new SorobanTraceDecodeError(
        `Soroban event value in transaction ${transactionHash} is not valid base64.`,
      );
    }
  }

  /**
   * Get provider for network ID
   */
  private getProvider(networkId: string): ethers.providers.Provider | StellarProvider | null {
    if (networkId === STELLAR_NETWORK_ID) {
      return this.stellarProvider;
    }
    return this.providers.get(networkId) || null;
  }

  /**
   * Handle job failures and route to DLQ if max attempts reached
   */
  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;
    // A job also fails permanently when the worker reports it as unrecoverable
    // (e.g. an oversized payload that exceeded the bounded resource policy).
    const isPermanentFailure =
      job.attemptsMade >= maxAttempts || error?.name === 'UnrecoverableError';

    if (isPermanentFailure) {
      this.logger.warn(
        `Blockchain Job ${job.id} failed permanently after ${job.attemptsMade} attempts. Routing to DLQ.`,
      );
      await this.taskQueueService.moveToDeadLetterQueue(job, error.message);
    }
  }
}
