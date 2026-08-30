// Blockchain Processor Tests
// Processor-level coverage for failure handling and DLQ routing (issue #694)
//
// Acceptance criteria covered:
//  - Intermediate failures are not moved to the DLQ.
//  - Exhausted jobs move exactly once.
//  - Job identity and error message are preserved.
//  - Provider failure tests exist.

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { BlockchainProcessor, BlockchainEventJobData } from './blockchain.processor';
import { TaskQueueService } from '../services/task-queue.service';

describe('BlockchainProcessor', () => {
  let processor: BlockchainProcessor;
  let taskQueueService: { moveToDeadLetterQueue: jest.Mock };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  // Build a minimal BullMQ job shaped object for processor-level tests
  const createJob = (
    data: Partial<BlockchainEventJobData> = {},
    overrides: Partial<Job> = {},
  ): Job =>
    ({
      id: 'blockchain-job-1',
      queueName: 'blockchain-events',
      attemptsMade: 1,
      opts: { attempts: 3 },
      updateProgress: jest.fn().mockResolvedValue(undefined),
      data: {
        contractAddress: '0x123',
        eventName: 'Transfer',
        parameters: { fromBlock: 1000 },
        networkId: '1',
        action: 'process',
      },
      ...overrides,
      data: {
        contractAddress: '0x123',
        eventName: 'Transfer',
        parameters: { fromBlock: 1000 },
        networkId: '1',
        action: 'process',
        ...data,
      },
    }) as unknown as Job;

  beforeEach(async () => {
    jest.clearAllMocks();

    taskQueueService = {
      moveToDeadLetterQueue: jest.fn().mockResolvedValue({ id: 'dlq-job' }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainProcessor,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TaskQueueService, useValue: taskQueueService },
      ],
    }).compile();

    processor = moduleRef.get(BlockchainProcessor);
  });

  describe('onJobFailed - DLQ routing', () => {
    it('should NOT move intermediate failures to the DLQ', async () => {
      // Attempt 1 of 3: failure is retryable, nothing should hit the DLQ
      const job = createJob({}, { attemptsMade: 1, opts: { attempts: 3 } });

      await processor.onJobFailed(job, new Error('temporary provider timeout'));

      expect(taskQueueService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should move exhausted jobs to the DLQ exactly once', async () => {
      // Attempt 3 of 3: attempts exhausted, job is permanently failed
      const job = createJob({}, { attemptsMade: 3, opts: { attempts: 3 } });

      await processor.onJobFailed(job, new Error('permanent contract failure'));

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        job,
        'permanent contract failure',
      );
    });

    it('should preserve job identity and error message when routing to the DLQ', async () => {
      const job = createJob(
        {},
        { id: 'blockchain-job-42', attemptsMade: 5, opts: { attempts: 5 } },
      );
      const error = new Error('provider not configured for network 999');

      await processor.onJobFailed(job, error);

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'blockchain-job-42',
          queueName: 'blockchain-events',
        }),
        'provider not configured for network 999',
      );
    });

    it('should keep routing only the final attempt of a long-retry job to the DLQ', async () => {
      const job = createJob({}, { attemptsMade: 4, opts: { attempts: 5 } });

      await processor.onJobFailed(job, new Error('transient rpc error'));

      expect(taskQueueService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      // Final attempt: exactly one move to the DLQ
      const exhaustedJob = createJob({}, { attemptsMade: 5, opts: { attempts: 5 } });
      await processor.onJobFailed(exhaustedJob, new Error('transient rpc error'));

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        exhaustedJob,
        'transient rpc error',
      );
    });
  });

  describe('process - provider failures', () => {
    it('should fail when no provider is configured for the requested network', async () => {
      const job = createJob({ networkId: '999' });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'Provider not configured for network 999',
        networkId: '999',
        contractAddress: '0x123',
        eventName: 'Transfer',
      });
    });

    it('should fail when the provider cannot find a contract at the address', async () => {
      (processor as any).providers.set('1', {
        getCode: jest.fn().mockResolvedValue('0x'),
      });

      const job = createJob({ action: 'process' });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: expect.stringContaining('No contract found at 0x123'),
      });
    });

    it('should propagate provider network errors', async () => {
      (processor as any).providers.set('1', {
        getCode: jest.fn().mockRejectedValue(new Error('rate limit exceeded')),
      });

      const job = createJob({ action: 'process' });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'rate limit exceeded',
      });
    });

    it('should reject unknown actions before contacting the provider', async () => {
      (processor as any).providers.set('1', {
        getCode: jest.fn().mockResolvedValue('0x123456'),
      });

      const job = createJob({ action: 'hack' as any });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'Unknown action: hack',
      });
    });

    it('should complete successfully when the provider responds', async () => {
      (processor as any).providers.set('1', {
        getCode: jest.fn().mockResolvedValue('0x123456'),
      });

      const job = createJob({ action: 'process' });

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('process');
      expect(result.eventName).toBe('Transfer');
      expect(result.networkId).toBe('1');
      expect(result.contractAddress).toBe('0x123');
    });
  });

  describe('provider failure to DLQ routing (end-to-end at processor level)', () => {
    it('should route a permanently failed provider job to the DLQ with the original error', async () => {
      // Provider failure: network 999 is not configured
      const job = createJob({ networkId: '999' }, { attemptsMade: 3, opts: { attempts: 3 } });

      // Job fails on its final attempt due to the provider error
      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'Provider not configured for network 999',
      });

      // The failure hook must move the exhausted job to the DLQ exactly once,
      // preserving the original job identity and error message.
      await processor.onJobFailed(job, new Error('Provider not configured for network 999'));

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blockchain-job-1' }),
        'Provider not configured for network 999',
      );
    });
  });

  describe('process - action parameter validation (issue #693)', () => {
    it('rejects a verify job with no transactionHash as an unrecoverable failure', async () => {
      const job = createJob({ action: 'verify', parameters: {} });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
        message: expect.stringContaining('transactionHash'),
      });
    });

    it('rejects a verify job with a malformed transactionHash as unrecoverable', async () => {
      const job = createJob({ action: 'verify', parameters: { transactionHash: '0x12' } });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
      });
    });

    it('rejects an index job that is missing source identity as unrecoverable', async () => {
      const job = createJob({ action: 'index', parameters: { transactionHash: 'not-a-hash' } });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
      });
    });

    it('rejects a listen job with an invalid fromBlock as unrecoverable', async () => {
      const job = createJob({ action: 'listen', parameters: { fromBlock: -5 } });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
      });
    });

    it('rejects an unknown action as an unrecoverable failure', async () => {
      const job = createJob({ action: 'hack' as any, parameters: { fromBlock: 1 } });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
        message: 'Unknown action: hack',
      });
    });

    it('routes a parameter-invalid job to the DLQ on the first attempt', async () => {
      // A parameter error is a permanent failure: it must reach the DLQ at
      // attempt 1 of N, never consuming retries.
      const job = createJob(
        { action: 'verify', parameters: {} },
        { attemptsMade: 1, opts: { attempts: 5 } },
      );

      let thrown: Error | undefined;
      try {
        await processor.process(job);
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown).toBeDefined();
      expect(thrown?.name).toBe('UnrecoverableError');

      await processor.onJobFailed(job, thrown as Error);

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blockchain-job-1' }),
        expect.stringContaining('transactionHash'),
      );
    });

    it('lets a well-formed job reach the provider without validation failure', async () => {
      (processor as any).providers.set('1', {
        getLogs: jest.fn().mockResolvedValue([]),
      });

      const job = createJob({
        action: 'listen',
        parameters: { fromBlock: '0x10', toBlock: 'latest' },
      });

      const result = await processor.process(job);
      expect(result.success).toBe(true);
      expect(result.action).toBe('listen');
    });
  });
});
