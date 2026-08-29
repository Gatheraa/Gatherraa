// Blockchain processor & validation tests
// Covers:
//  - Canonical exact event identity (issue #689): no substring topic matching,
//    case-safe address comparison, deterministic handling of malformed receipts.
//  - Bounded resource policy (issue #691): byte and batch limits with safe
//    defaults enforced at every ingestion entry point (service, controller,
//    worker), with oversized jobs failing as permanent input failures.

import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import {
  BlockchainProcessor,
  canonicalEventTopic,
  isEventLogFor,
  isSameAddress,
} from './blockchain.processor';
import {
  BlockchainPayloadLimitError,
  assertBlockchainEventPayloadWithinLimits,
  countBatchItems,
  serializedPayloadBytes,
  DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS,
} from './blockchain.validation';
import { TaskQueueService } from '../services/task-queue.service';
import { TaskQueueController } from '../task-queue.controller';

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const OTHER_TOPIC = `0x${'00'.repeat(32)}`;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createFakeJob(data: any, overrides: any = {}): Job {
  return {
    id: 'blockchain-job-1',
    name: 'blockchain-event',
    queueName: 'blockchain-events',
    data,
    attemptsMade: 0,
    opts: { attempts: 5 },
    stacktrace: [],
    updateProgress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Job;
}

function createMockConfigService(values: Record<string, number> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: any) =>
      key in values ? values[key] : defaultValue,
    ),
  } as unknown as ConfigService;
}

function createProcessor(configService: ConfigService = createMockConfigService()) {
  const taskQueueService = {
    moveToDeadLetterQueue: jest.fn().mockResolvedValue({}),
  } as unknown as TaskQueueService;
  const processor = new BlockchainProcessor(configService, taskQueueService);
  return { processor, taskQueueService };
}

function createReceipt(logs: any[]): any {
  return {
    blockNumber: 12345,
    gasUsed: '21000',
    logs,
  };
}

/** Processor wired to a fake provider for the given network. */
function createVerifyProcessor(logs: any[], eventName: string) {
  const { processor } = createProcessor();
  const provider = {
    getTransactionReceipt: jest
      .fn()
      .mockResolvedValue(createReceipt(logs)),
  } as any;
  (processor as any).providers.set('1', provider);
  const job = createFakeJob({
    contractAddress: '0xABCdef',
    eventName,
    parameters: { transactionHash: '0xdeadbeef' },
    networkId: '1',
    action: 'verify',
  });
  return { processor, job, provider };
}

function createQueueMock(name: string) {
  return {
    name,
    add: jest.fn().mockResolvedValue({ id: `job-${name}`, data: {} }),
  };
}

function createTaskQueueService(configService: ConfigService) {
  const queueNames = [
    'email',
    'email:dlq',
    'image-processing',
    'image-processing:dlq',
    'blockchain-events',
    'blockchain-events:dlq',
    'scheduled-tasks',
    'scheduled-tasks:dlq',
    'notifications',
    'notifications:dlq',
    'analytics',
    'analytics:dlq',
    'dead-letter',
    'waitlist:notifications',
    'waitlist:notifications:dlq',
    'waitlist:expiry',
    'waitlist:expiry:dlq',
    'waitlist:invite',
    'waitlist:invite:dlq',
  ];
  const queues = queueNames.map(createQueueMock);
  const service = new TaskQueueService(
    ...(queues as any),
    configService,
  );
  return { service, queues };
}

// ---------------------------------------------------------------------------
// Issue #689 — canonical exact event identity
// ---------------------------------------------------------------------------

describe('canonicalEventTopic', () => {
  it('normalizes an already-encoded 32-byte topic to lowercase', () => {
    expect(canonicalEventTopic(TRANSFER_TOPIC.toUpperCase())).toBe(
      TRANSFER_TOPIC,
    );
    expect(canonicalEventTopic(TRANSFER_TOPIC)).toBe(TRANSFER_TOPIC);
  });

  it('derives the canonical topic from a full event signature', () => {
    expect(canonicalEventTopic('Transfer(address,address,uint256)')).toBe(
      TRANSFER_TOPIC,
    );
  });

  it('returns null for bare event names (no canonical identity)', () => {
    expect(canonicalEventTopic('Transfer')).toBeNull();
  });

  it('returns null for malformed or missing event names', () => {
    expect(canonicalEventTopic('')).toBeNull();
    expect(canonicalEventTopic('   ')).toBeNull();
    expect(canonicalEventTopic('0x1234')).toBeNull();
    expect(canonicalEventTopic(null as any)).toBeNull();
    expect(canonicalEventTopic(undefined as any)).toBeNull();
  });
});

describe('isSameAddress', () => {
  it('matches addresses case-insensitively', () => {
    expect(isSameAddress('0xABCdef', '0xabcdef')).toBe(true);
    expect(isSameAddress('0xabc', '0xabc')).toBe(true);
  });

  it('rejects different or malformed addresses deterministically', () => {
    expect(isSameAddress('0xabc', '0xabd')).toBe(false);
    expect(isSameAddress('', '0xabc')).toBe(false);
    expect(isSameAddress(null, '0xabc')).toBe(false);
    expect(isSameAddress(123 as any, '0xabc')).toBe(false);
  });
});

describe('isEventLogFor', () => {
  it('matches the canonical signature topic exactly', () => {
    const log = { topics: [TRANSFER_TOPIC, OTHER_TOPIC, OTHER_TOPIC] };
    expect(isEventLogFor(log, TRANSFER_TOPIC)).toBe(true);
  });

  it('matches case-insensitively on the signature topic', () => {
    const log = { topics: [TRANSFER_TOPIC.toUpperCase()] };
    expect(isEventLogFor(log, TRANSFER_TOPIC)).toBe(true);
  });

  it('rejects substring collisions (longer topic containing the expected identity)', () => {
    const longerTopic = `${TRANSFER_TOPIC}00`;
    const log = { topics: [longerTopic] };
    // Old behavior used substring matching and would accept this.
    expect(longerTopic.includes(TRANSFER_TOPIC)).toBe(true);
    expect(isEventLogFor(log, TRANSFER_TOPIC)).toBe(false);
  });

  it('rejects a matching value that only appears in a non-signature topic', () => {
    const log = { topics: [OTHER_TOPIC, TRANSFER_TOPIC] };
    // Old behavior scanned every indexed topic and would accept this.
    expect(log.topics.some((t: string) => t.includes(TRANSFER_TOPIC))).toBe(
      true,
    );
    expect(isEventLogFor(log, TRANSFER_TOPIC)).toBe(false);
  });

  it('rejects bare event names instead of substring-matching', () => {
    const log = { topics: [TRANSFER_TOPIC] };
    expect(isEventLogFor(log, 'Transfer')).toBe(false);
  });

  it('handles malformed logs deterministically without throwing', () => {
    expect(isEventLogFor({}, TRANSFER_TOPIC)).toBe(false);
    expect(isEventLogFor({ topics: undefined }, TRANSFER_TOPIC)).toBe(false);
    expect(isEventLogFor({ topics: [] }, TRANSFER_TOPIC)).toBe(false);
    expect(isEventLogFor({ topics: [123] }, TRANSFER_TOPIC)).toBe(false);
    expect(isEventLogFor(null, TRANSFER_TOPIC)).toBe(false);
    expect(isEventLogFor('not-a-log' as any, TRANSFER_TOPIC)).toBe(false);
  });
});

describe('BlockchainProcessor.verifyEvent (via process)', () => {
  it('verifies an exact signature-topic match with case-insensitive address', async () => {
    const { processor, job } = createVerifyProcessor(
      [
        {
          address: '0xABCDEF',
          topics: [TRANSFER_TOPIC, OTHER_TOPIC, OTHER_TOPIC],
        },
      ],
      'Transfer(address,address,uint256)',
    );
    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(result.result.verified).toBe(true);
  });

  it('rejects a substring-colliding topic', async () => {
    const { processor, job } = createVerifyProcessor(
      [{ address: '0xabcdef', topics: [`${TRANSFER_TOPIC}00`] }],
      TRANSFER_TOPIC,
    );
    const result = await processor.process(job);
    expect(result.result.verified).toBe(false);
  });

  it('rejects a matching value in a non-signature topic', async () => {
    const { processor, job } = createVerifyProcessor(
      [{ address: '0xabcdef', topics: [OTHER_TOPIC, TRANSFER_TOPIC] }],
      TRANSFER_TOPIC,
    );
    const result = await processor.process(job);
    expect(result.result.verified).toBe(false);
  });

  it('deterministically returns unverified for malformed logs without throwing', async () => {
    const { processor, job } = createVerifyProcessor(
      [
        { address: '0xabcdef', topics: undefined },
        { address: '0xabcdef' },
        null,
      ],
      TRANSFER_TOPIC,
    );
    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(result.result.verified).toBe(false);
  });

  it('returns unverified for a bare event name (no canonical identity)', async () => {
    const { processor, job } = createVerifyProcessor(
      [{ address: '0xabcdef', topics: [TRANSFER_TOPIC] }],
      'Transfer',
    );
    const result = await processor.process(job);
    expect(result.result.verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Issue #691 — bounded resource policy
// ---------------------------------------------------------------------------

describe('countBatchItems', () => {
  it('counts array-shaped parameters', () => {
    expect(countBatchItems([1, 2, 3])).toBe(3);
    expect(countBatchItems([])).toBe(0);
  });

  it('counts conventional batch fields and takes the largest', () => {
    expect(countBatchItems({ logs: [1, 2], events: [1, 2, 3] })).toBe(3);
    expect(countBatchItems({ batch: Array(7).fill({}) })).toBe(7);
  });

  it('ignores non-array and absent fields', () => {
    expect(countBatchItems({})).toBe(0);
    expect(countBatchItems({ logs: 'not-an-array' })).toBe(0);
    expect(countBatchItems(null)).toBe(0);
    expect(countBatchItems('nope')).toBe(0);
    expect(countBatchItems(42)).toBe(0);
  });
});

describe('assertBlockchainEventPayloadWithinLimits', () => {
  const limits = { maxPayloadBytes: 1024, maxBatchSize: 10 };

  it('accepts a payload exactly at the byte limit (boundary)', () => {
    const base = {
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { padding: '' },
    };
    const baseBytes = serializedPayloadBytes(base);
    const data = {
      ...base,
      parameters: { padding: 'x'.repeat(limits.maxPayloadBytes - baseBytes) },
    };
    expect(serializedPayloadBytes(data)).toBe(limits.maxPayloadBytes);
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).not.toThrow();
  });

  it('rejects a payload one byte over the limit', () => {
    const data = {
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { padding: 'x'.repeat(limits.maxPayloadBytes) },
    };
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).toThrow(BlockchainPayloadLimitError);
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).toThrow(/bytes/);
  });

  it('accepts a batch exactly at the item limit (boundary)', () => {
    const data = {
      contractAddress: '0xabc',
      eventName: 'Event',
      parameters: { logs: Array(limits.maxBatchSize).fill({}) },
    };
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).not.toThrow();
  });

  it('rejects a batch over the item limit', () => {
    const data = {
      contractAddress: '0xabc',
      eventName: 'Event',
      parameters: { logs: Array(limits.maxBatchSize + 1).fill({}) },
    };
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).toThrow(BlockchainPayloadLimitError);
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).toThrow(/items/);
  });

  it('rejects array-shaped parameters over the batch limit', () => {
    const data = {
      contractAddress: '0xabc',
      eventName: 'Event',
      parameters: Array(limits.maxBatchSize + 1).fill({}),
    };
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data, limits),
    ).toThrow(BlockchainPayloadLimitError);
  });

  it('applies safe configuration defaults when no limits are provided', () => {
    expect(DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS.maxPayloadBytes).toBeGreaterThan(
      0,
    );
    expect(DEFAULT_BLOCKCHAIN_RESOURCE_LIMITS.maxBatchSize).toBeGreaterThan(0);
    const data = { parameters: {} };
    expect(() =>
      assertBlockchainEventPayloadWithinLimits(data),
    ).not.toThrow();
  });
});

describe('BlockchainProcessor resource policy (via process)', () => {
  it('fails oversized jobs as permanent input failures before any processing', async () => {
    const { processor, taskQueueService } = createProcessor();
    const job = createFakeJob({
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { padding: 'x'.repeat(70 * 1024) }, // > 64 KiB default
    });

    await expect(processor.process(job)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
    // The provider lookup must never happen: the failure is pre-decode.
    expect(job.updateProgress).not.toHaveBeenCalled();
  });

  it('rejects oversized batches as permanent input failures', async () => {
    const configService = createMockConfigService({
      BLOCKCHAIN_MAX_BATCH_SIZE: 5,
    });
    const { processor } = createProcessor(configService);
    const job = createFakeJob({
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { logs: Array(6).fill({}) },
    });

    await expect(processor.process(job)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
  });

  it('processes jobs within the limits normally', async () => {
    const { processor } = createProcessor();
    const provider = { getCode: jest.fn().mockResolvedValue('0x1234') } as any;
    (processor as any).providers.set('1', provider);
    const job = createFakeJob({
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { padding: 'small' },
      networkId: '1',
      action: 'process',
    });

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(provider.getCode).toHaveBeenCalledWith('0xabc');
  });

  it('routes unrecoverable failures to the dead letter queue', async () => {
    const { processor, taskQueueService } = createProcessor();
    const job = createFakeJob({}, { attemptsMade: 1 });

    await processor.onJobFailed(
      job,
      new UnrecoverableError('Blockchain event job payload exceeds limit'),
    );

    expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
    expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
      job,
      'Blockchain event job payload exceeds limit',
    );
  });

  it('does not route retryable failures before attempts are exhausted', async () => {
    const { processor, taskQueueService } = createProcessor();
    const job = createFakeJob({}, { attemptsMade: 1 });

    await processor.onJobFailed(job, new Error('transient failure'));

    expect(taskQueueService.moveToDeadLetterQueue).not.toHaveBeenCalled();
  });

  it('routes ordinary exhausted failures to the dead letter queue', async () => {
    const { processor, taskQueueService } = createProcessor();
    const job = createFakeJob({}, { attemptsMade: 5 });

    await processor.onJobFailed(job, new Error('still failing'));

    expect(taskQueueService.moveToDeadLetterQueue).toHaveBeenCalledTimes(1);
  });
});

describe('TaskQueueService.enqueueBlockchainEvent limits', () => {
  it('rejects oversized payloads before they enter the queue', async () => {
    const { service, queues } = createTaskQueueService(
      createMockConfigService({ BLOCKCHAIN_MAX_PAYLOAD_BYTES: 256 }),
    );
    const data = {
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { padding: 'x'.repeat(300) },
    };

    await expect(service.enqueueBlockchainEvent(data)).rejects.toBeInstanceOf(
      BlockchainPayloadLimitError,
    );
    expect(queues[4].add).not.toHaveBeenCalled();
  });

  it('rejects oversized batches before they enter the queue', async () => {
    const { service, queues } = createTaskQueueService(
      createMockConfigService({ BLOCKCHAIN_MAX_BATCH_SIZE: 3 }),
    );
    const data = {
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { events: Array(4).fill({}) },
    };

    await expect(service.enqueueBlockchainEvent(data)).rejects.toBeInstanceOf(
      BlockchainPayloadLimitError,
    );
    expect(queues[4].add).not.toHaveBeenCalled();
  });

  it('enqueues payloads within the limits', async () => {
    const { service, queues } = createTaskQueueService(
      createMockConfigService(),
    );
    const data = {
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: { fromBlock: 1, toBlock: 10 },
    };

    await service.enqueueBlockchainEvent(data);
    expect(queues[4].add).toHaveBeenCalledTimes(1);
  });
});

describe('TaskQueueController.enqueueBlockchainEvent limits', () => {
  it('maps payload limit errors to HTTP 413 Payload Too Large', async () => {
    const controller = new TaskQueueController({
      enqueueBlockchainEvent: jest
        .fn()
        .mockRejectedValue(
          new BlockchainPayloadLimitError('Blockchain event job payload exceeds limit'),
        ),
    } as any);

    await expect(
      controller.enqueueBlockchainEvent({
        contractAddress: '0xabc',
        eventName: 'Transfer',
        parameters: {},
      }),
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await controller.enqueueBlockchainEvent({
        contractAddress: '0xabc',
        eventName: 'Transfer',
        parameters: {},
      });
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  });

  it('accepts valid blockchain event payloads', async () => {
    const controller = new TaskQueueController({
      enqueueBlockchainEvent: jest
        .fn()
        .mockResolvedValue({ id: 'blockchain-ok' }),
    } as any);

    const response = await controller.enqueueBlockchainEvent({
      contractAddress: '0xabc',
      eventName: 'Transfer',
      parameters: {},
    });

    expect(response.success).toBe(true);
    expect(response.jobId).toBe('blockchain-ok');
  });
});
