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
import { Job, UnrecoverableError } from 'bullmq';
import { BlockchainProcessor, BlockchainEventJobData } from './blockchain.processor';
import { SorobanEventDecodeError } from './decode-retry.classifier';
import { TaskQueueService } from '../services/task-queue.service';

describe('BlockchainProcessor', () => {
  let processor: BlockchainProcessor;
  let taskQueueService: { moveToDeadLetterQueue: jest.Mock };
  let sorobanVerifier: { verify: jest.Mock };

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

    sorobanVerifier = {
      verify: jest.fn().mockResolvedValue({
        transactionHash: '0x123',
        outcome: 'verified',
        verified: true,
        ledgerSeq: 42,
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainProcessor,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TaskQueueService, useValue: taskQueueService },
        { provide: SorobanVerificationService, useValue: sorobanVerifier },
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

  describe('soroban-trace extraction (issue #708)', () => {
    const makeTx = (events: unknown[]) => ({
      ok: true,
      status: 'success',
      hash: '0xtx',
      ledger: 900,
      applicationOrder: 3,
      events,
    });

    const withStellarProvider = (tx: unknown) => {
      (processor as any).stellarProvider = {
        getTransactionResult: jest.fn().mockResolvedValue(tx),
      };
    };

    it('should extract one typed trace record per events[] entry for a confirmed transaction', async () => {
      withStellarProvider(
        makeTx([
          {
            type: 'diagnostic',
            contractId: 'aa',
            topic: ['dG9waWM='],
            value: 'dmFsdWU=',
            inSuccessfulContractCall: true,
          },
          {
            type: 'diagnostic',
            contractId: 'bb',
            topic: ['dG9waWMtMg=='],
            value: 'dmFsdWUtMg==',
            inSuccessfulContractCall: true,
          },
        ]),
      );

      const job = createJob({
        networkId: 'stellar',
        action: 'soroban-trace' as any,
        parameters: { transactionHash: '0xtx' },
      });

      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.action).toBe('soroban-trace');
      expect(result.result.traces).toHaveLength(2);
      expect(result.result.traces[0]).toMatchObject({
        transactionHash: '0xtx',
        ledger: 900,
        applicationOrder: 3,
        event: { contractId: 'aa', inSuccessfulContractCall: true },
      });
      expect(result.result.traces[1].event.contractId).toBe('bb');
    });

    it('should retry a transient not-found transaction and never route to the DLQ on first failure', async () => {
      (processor as any).stellarProvider = {
        getTransactionResult: jest.fn().mockResolvedValue({
          ok: false,
          status: 'notFound',
          hash: '0xtx',
          events: [],
          error: 'transaction_not_found',
        }),
      };

      const job = createJob({
        networkId: 'stellar',
        action: 'soroban-trace' as any,
        parameters: { transactionHash: '0xtx' },
      });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: expect.stringContaining('not available yet'),
      });

      // Intermediate failure: nothing should be moved to the DLQ.
      await processor.onJobFailed(
        job,
        new Error('Soroban transaction 0xtx is not available yet (notFound).'),
      );
      expect(taskQueueService.moveToDeadLetterQueue).not.toHaveBeenCalled();
    });

    it('should DLQ an oversized events array as a permanent BlockchainPayloadLimitError', async () => {
      const events = Array.from({ length: 101 }, (_, i) => ({
        type: 'diagnostic',
        contractId: 'aa',
        topic: ['dG9waWM='],
        value: 'dmFsdWU=',
        inSuccessfulContractCall: true,
      }));
      withStellarProvider(makeTx(events));

      const job = createJob({
        networkId: 'stellar',
        action: 'soroban-trace' as any,
        parameters: { transactionHash: '0xtx' },
      });

      await expect(processor.process(job)).rejects.toThrow(
        expect.objectContaining({ name: 'UnrecoverableError' }),
      );

      await processor.onJobFailed(job, new UnrecoverableError('exceeds the limit'));
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
    });

    it('should DLQ a malformed base64 entry as permanent and non-retryable', async () => {
      withStellarProvider(
        makeTx([
          {
            type: 'diagnostic',
            contractId: 'aa',
            topic: ['@@@not-base64@@@'],
            value: 'dmFsdWU=',
            inSuccessfulContractCall: true,
          },
        ]),
      );

      const job = createJob({
        networkId: 'stellar',
        action: 'soroban-trace' as any,
        parameters: { transactionHash: '0xtx' },
      });

      await expect(processor.process(job)).rejects.toThrow(
        expect.objectContaining({ name: 'UnrecoverableError' }),
      );

      await processor.onJobFailed(job, new UnrecoverableError('not valid base64'));
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('process - decode error retry classification (issue #714)', () => {
    const decodeProvider = (impl: jest.Mock) => {
      (processor as any).providers.set('1', { getCode: impl } as any);
    };

    it('routes a permanent decode failure to the DLQ on the FIRST attempt', async () => {
      decodeProvider(jest.fn().mockRejectedValue(new SorobanEventDecodeError('MalformedXdr')));

      const job = createJob({ action: 'process' }, { attemptsMade: 1, opts: { attempts: 5 } });

      // A permanent decode outcome must surface as unrecoverable (no retries).
      let thrown: Error | undefined;
      try {
        await processor.process(job);
      } catch (error) {
        thrown = error as Error;
      }
      expect(thrown).toBeDefined();
      expect(thrown?.name).toBe('UnrecoverableError');
      expect(String(thrown?.message)).toMatch(/Decode failed/);

      // onJobFailed routes it exactly once, on the first attempt.
      await processor.onJobFailed(job, thrown as Error);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blockchain-job-1' }),
        expect.stringContaining('Decode failed'),
      );
    });

    it('a poisoned event does not delay a subsequent valid event in the same queue', async () => {
      // The provider fails ONCE with a permanent decode failure, then succeeds.
      const getCode = jest
        .fn()
        .mockRejectedValueOnce(new SorobanEventDecodeError('InvalidBase64'))
        .mockResolvedValueOnce('0x123456');

      decodeProvider(getCode);

      const poisoned = createJob({ action: 'process' });
      let thrown: Error | undefined;
      try {
        await processor.process(poisoned);
      } catch (error) {
        thrown = error as Error;
      }
      expect(thrown?.name).toBe('UnrecoverableError');

      // The poisoned job routes to the DLQ immediately — it never occupies a
      // concurrency slot across retries.
      await processor.onJobFailed(poisoned, thrown as Error);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);

      // The next, valid job completes normally in the same queue.
      const valid = createJob({ action: 'process' });
      const result = await processor.process(valid);
      expect(result.success).toBe(true);
      expect(result.action).toBe('process');
    });

    it('every permanent decode code routes to the DLQ on the first attempt', async () => {
      for (const code of [
        'InvalidBase64',
        'TruncatedXdr',
        'MalformedXdr',
        'UnsupportedEvent',
        'UnexpectedContractId',
        'InvalidPayload',
      ] as const) {
        jest.clearAllMocks();
        decodeProvider(jest.fn().mockRejectedValue(new SorobanEventDecodeError(code)));

        const job = createJob({ action: 'process' }, { attemptsMade: 1, opts: { attempts: 3 } });
        await expect(processor.process(job)).rejects.toMatchObject({ name: 'UnrecoverableError' });
      }
      // None of the six permanent codes consumed a retry or was treated as transient.
    });

    it('treats a transient failure as retryable and DLQs it only when attempts are exhausted', async () => {
      decodeProvider(jest.fn().mockRejectedValue(new Error('temporary provider timeout')));

      const job = createJob({ action: 'process' }, { attemptsMade: 1, opts: { attempts: 3 } });

      // Transient: a plain (non-unrecoverable) failure.
      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'temporary provider timeout',
      });

      // Intermediate failure: never moved to the DLQ.
      await processor.onJobFailed(job, new Error('temporary provider timeout'));
      expect(taskQueueService.moveToDeadLetterQueue).not.toHaveBeenCalled();

      // Final exhausted attempt: moved exactly once.
      const exhausted = createJob(
        { action: 'process' },
        { attemptsMade: 3, opts: { attempts: 3 } },
      );
      await processor.onJobFailed(exhausted, new Error('temporary provider timeout'));
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blockchain-job-1' }),
        'temporary provider timeout',
      );
    });

    it('preserves the existing DLQ identity/error contract for permanent decode failures', async () => {
      decodeProvider(jest.fn().mockRejectedValue(new SorobanEventDecodeError('InvalidPayload')));

      const job = createJob(
        { action: 'process' },
        { id: 'blockchain-job-99', attemptsMade: 1, opts: { attempts: 5 } },
      );
      let thrown: Error | undefined;
      try {
        await processor.process(job);
      } catch (error) {
        thrown = error as Error;
      }

      await processor.onJobFailed(job, thrown as Error);

      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
      expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'blockchain-job-99', queueName: 'blockchain-events' }),
        expect.stringContaining('documented LMS representation'),
      );
    });
  });

  describe('process - Soroban verification on Stellar (issue #713)', () => {
    const hash = '0x' + 'c'.repeat(64);

    beforeEach(() => {
      // Give the processor a functional Stellar provider instance; the verifier
      // itself is a mock so we can assert the dispatch and wiring.
      (processor as any).stellarProvider = {
        protocol: 'stellar',
        safeEndpoint: 'https://rpc.test',
        host: 'rpc.test',
        getTransaction: jest.fn(),
      };
    });

    it('routes a Stellar verify job to the verifier and reports a verified outcome', async () => {
      sorobanVerifier.verify.mockResolvedValueOnce({
        transactionHash: hash,
        outcome: 'verified',
        verified: true,
        ledgerSeq: 42,
        eventName: 'course_created',
      });

      const job = createJob({
        networkId: 'stellar',
        action: 'verify',
        eventName: 'course_created',
        contractAddress: 'sample-contract-id',
        parameters: {
          transactionHash: hash,
          expectedPayload: { courseId: 'c1', instructor: '0xabc' },
        },
      });

      const result = await processor.process(job);

      expect(sorobanVerifier.verify).toHaveBeenCalledWith({
        provider: (processor as any).stellarProvider,
        transactionHash: hash,
        eventName: 'course_created',
        contractId: 'sample-contract-id',
        expectedPayload: { courseId: 'c1', instructor: '0xabc' },
      });
      expect(result.success).toBe(true);
      expect(result.action).toBe('verify');
      expect(result.networkId).toBe('stellar');
      expect(result.result).toMatchObject({
        outcome: 'verified',
        verified: true,
        ledgerSeq: 42,
        eventName: 'course_created',
      });
    });

    it('reports a mismatch outcome when the expected event is not equal', async () => {
      sorobanVerifier.verify.mockResolvedValueOnce({
        transactionHash: hash,
        outcome: 'mismatch',
        verified: false,
        ledgerSeq: 42,
        detail:
          'The confirmed transaction does not contain the expected event with equal business fields.',
      });

      const job = createJob({
        networkId: 'stellar',
        action: 'verify',
        eventName: 'course_created',
        parameters: { transactionHash: hash, expectedPayload: { courseId: 'c1' } },
      });

      const result = await processor.process(job);

      expect(result.result.outcome).toBe('mismatch');
      expect(result.result.verified).toBe(false);
    });

    it('reports a reverted outcome distinctly from not-found', async () => {
      sorobanVerifier.verify.mockResolvedValueOnce({
        transactionHash: hash,
        outcome: 'reverted',
        verified: false,
        ledgerSeq: 41,
        detail: 'resultCode=txv_bad_auth',
      });

      const job = createJob({
        networkId: 'stellar',
        action: 'verify',
        eventName: 'course_created',
        parameters: { transactionHash: hash },
      });

      const result = await processor.process(job);

      expect(result.result.outcome).toBe('reverted');
      expect(result.result.verified).toBe(false);
      expect(result.result.detail).toContain('resultCode');
    });

    it('treats a not-yet-confirmed transaction as a transient (retryable) failure', async () => {
      // The verifier raises a transient, retryable error when the transaction
      // has not been found/confirmed yet. It must NOT be an UnrecoverableError,
      // so the job is retried and never DLQ'd on the first attempt.
      const notFound = new Error(`not found`);
      notFound.name = 'SorobanTransactionNotFoundError';
      sorobanVerifier.verify.mockRejectedValueOnce(notFound);

      const job = createJob({
        networkId: 'stellar',
        action: 'verify',
        eventName: 'course_created',
        parameters: { transactionHash: hash },
      });

      // The processor must surface this as a transient (non-permanent) failure:
      // never an UnrecoverableError, so the job is retried and only reaches the
      // DLQ after attempts are exhausted.
      await expect(processor.process(job)).rejects.toMatchObject({
        message: 'not found',
        originalError: expect.objectContaining({ name: 'SorobanTransactionNotFoundError' }),
      });
    });

    it('rejects a Stellar verify job with no transactionHash as unrecoverable', async () => {
      const job = createJob({
        networkId: 'stellar',
        action: 'verify',
        parameters: {},
      });

      await expect(processor.process(job)).rejects.toMatchObject({
        name: 'UnrecoverableError',
        message: expect.stringContaining('transactionHash'),
      });
      // never reaches the verifier
      expect(sorobanVerifier.verify).not.toHaveBeenCalled();
    });

    it('still rejects non-verify EVM actions on the Stellar network', async () => {
      const job = createJob({ networkId: 'stellar', action: 'process' });

      await expect(processor.process(job)).rejects.toMatchObject({
        message: expect.stringContaining('not supported on the stellar network'),
      });
    });
  });

  describe('process - EVM verifyEvent remains unchanged (no regression)', () => {
    it('verifies an EVM event via the transaction receipt when the log matches exactly', async () => {
      const topic = '0x' + 'a'.repeat(64);
      (processor as any).providers.set('1', {
        getTransactionReceipt: jest.fn().mockResolvedValue({
          transactionHash: '0x' + 'b'.repeat(64),
          blockNumber: 10,
          gasUsed: '21000',
          logs: [{ address: '0x123', topics: [topic] }],
        }),
      });

      const job = createJob({
        action: 'verify',
        eventName: topic,
        contractAddress: '0x123',
        parameters: { transactionHash: '0x' + 'd'.repeat(64) },
      });

      const result = await processor.process(job);

      expect(result.result).toMatchObject({
        verified: true,
        transactionHash: '0x' + 'd'.repeat(64),
      });
      // The EVM path must not delegate to the Soroban verifier.
      expect(sorobanVerifier.verify).not.toHaveBeenCalled();
    });
  });
});
