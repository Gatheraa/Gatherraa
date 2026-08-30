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
import { StellarProvider } from '../providers/stellar.provider';

export interface BlockchainEventJobData {
  contractAddress: string;
  eventName: string;
  parameters: any;
  networkId?: string;
  rpcUrl?: string;
  action?: 'listen' | 'process' | 'verify' | 'index';
}

// --- Canonical event identity ----------------------------------------------
// An EVM event's canonical identity is its signature topic (topics[0]), the
// Keccak-256 hash of the event signature. Matching must be exact: substring
// matching over encoded topics can collide, letting unrelated logs be accepted
// or valid events be rejected.

const HEX_TOPIC_PATTERN = /^0[xX][0-9a-fA-F]{64}$/;

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
      validateBlockchainEventParameters(action as BlockchainAction, parameters);

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
        // apply. Fail clearly instead of silently executing EVM JSON-RPC
        // against a Stellar endpoint.
        throw new Error(
          `Action '${action}' is not supported on the ${STELLAR_NETWORK_ID} network. ` +
            `Stellar uses the Soroban protocol, not EVM JSON-RPC.`,
        );
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
