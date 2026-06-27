// Blockchain Event Job Processor
// Handles blockchain event processing and contract interactions

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TaskQueueService } from '../services/task-queue.service';

export interface BlockchainEventJobData {
  contractAddress: string;
  eventName: string;
  parameters: any;
  networkId?: string;
  rpcUrl?: string;
  action?: 'listen' | 'process' | 'verify' | 'index';
}

/**
 * Processor for blockchain event jobs
 * Handles event listening, processing, and contract interactions
 */
@Processor('blockchain-events', { concurrency: 5 })
@Injectable()
export class BlockchainProcessor extends WorkerHost {
  private readonly logger = new Logger(BlockchainProcessor.name);
  private providers: Map<string, ethers.Provider> = new Map();

  constructor(
    private configService: ConfigService,
    private readonly taskQueueService: TaskQueueService,
  ) {
    super();
    this.initializeProviders();
  }

  /**
   * Initialize blockchain providers for different networks
   */
  private initializeProviders() {
    // Ethereum Mainnet
    const mainnetRpc = this.configService.get<string>('ETH_MAINNET_RPC');
    if (mainnetRpc) {
      this.providers.set('1', new ethers.JsonRpcProvider(mainnetRpc));
    }

    // Sepolia Testnet
    const sepoliaRpc = this.configService.get<string>('ETH_SEPOLIA_RPC');
    if (sepoliaRpc) {
      this.providers.set('11155111', new ethers.JsonRpcProvider(sepoliaRpc));
    }

    // Polygon
    const polygonRpc = this.configService.get<string>('POLYGON_RPC');
    if (polygonRpc) {
      this.providers.set('137', new ethers.JsonRpcProvider(polygonRpc));
    }

    // Stellar (via bridge or API)
    const stellarRpc = this.configService.get<string>('STELLAR_RPC');
    if (stellarRpc) {
      this.providers.set('stellar', new ethers.JsonRpcProvider(stellarRpc));
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
      this.logger.log(
        `Processing blockchain event job ${jobId}: ${eventName} on network ${networkId}`,
      );

      await job.updateProgress(10);

      // Get provider for network
      const provider = this.getProvider(networkId);
      if (!provider) {
        throw new Error(`Provider not configured for network ${networkId}`);
      }

      await job.updateProgress(25);

      // Route to appropriate action
      let result;
      switch (action) {
        case 'listen':
          result = await this.listenToEvent(
            provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'process':
          result = await this.processEvent(
            provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'verify':
          result = await this.verifyEvent(
            provider,
            contractAddress,
            eventName,
            parameters,
            job,
          );
          break;
        case 'index':
          result = await this.indexEvent(
            provider,
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

      this.logger.log(
        `Blockchain event job ${jobId} completed successfully`,
      );

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
    provider: ethers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(
      `Setting up event listener for ${eventName} on ${contractAddress}`,
    );

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
    provider: ethers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(
      `Processing event ${eventName} with parameters`,
      parameters,
    );

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
    provider: ethers.Provider,
    contractAddress: string,
    eventName: string,
    parameters: any,
    job: Job,
  ): Promise<any> {
    this.logger.log(`Verifying event ${eventName}`);

    await job.updateProgress(50);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(
      parameters.transactionHash,
    );

    if (!receipt) {
      throw new Error(
        `Transaction ${parameters.transactionHash} not found`,
      );
    }

    await job.updateProgress(75);

    // Verify event was emitted
    const eventFound = receipt.logs.some(
      (log) =>
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.topics.some((topic) => topic.includes(eventName)),
    );

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
    provider: ethers.Provider,
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
  private getProvider(networkId: string): ethers.Provider | null {
    return this.providers.get(networkId) || null;
  }

  /**
   * Handle job failures and route to DLQ if max attempts reached
   */
  @OnWorkerEvent('failed')
  async onJobFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade >= maxAttempts) {
      this.logger.warn(
        `Blockchain Job ${job.id} failed permanently after ${job.attemptsMade} attempts. Routing to DLQ.`,
      );
      await this.taskQueueService.moveToDeadLetterQueue(job, error.message);
    }
  }
}
