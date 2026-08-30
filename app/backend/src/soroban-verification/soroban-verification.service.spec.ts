// SorobanVerificationService tests (issue #713).
//
// Proves the outcome taxonomy (verified / reverted / mismatch / transient
// not-found), the retryable classification of a not-yet-confirmed transaction,
// business-field equality, and durable idempotent persistence (re-verifying
// updates the same row, never duplicates it).

import { DataSource } from 'typeorm';
import {
  SorobanVerificationRecord,
  SorobanVerificationOutcome,
} from './entities/soroban-verification.entity';
import {
  SorobanTransactionNotFoundError,
  SorobanVerificationService,
  sorobanPayloadsEqual,
} from './soroban-verification.service';
import { StellarProvider } from '../task-queue/providers/stellar.provider';

/** Build a transaction-facing Stellar provider stub from a canned response. */
function providerReturning(run: (hash: string, provider: any) => Promise<any> = async () => ({})) {
  const stub = {
    getTransaction: jest.fn(run),
  };
  return stub as unknown as StellarProvider;
}

const EVENT_NAME_TOPIC = 'course_created';
const HASH = '0x' + 'e'.repeat(64);

describe('SorobanVerificationService (integration)', () => {
  let dataSource: DataSource;
  let service: SorobanVerificationService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SorobanVerificationRecord],
      synchronize: true,
    });
    await dataSource.initialize();
    service = new SorobanVerificationService(dataSource.getRepository(SorobanVerificationRecord));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(SorobanVerificationRecord).clear();
  });

  it('categorizes a SUCCESS transaction that contains the expected event as verified', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'SUCCESS',
      ledgerSeq: 42,
      events: [
        {
          eventName: EVENT_NAME_TOPIC,
          contractId: 'sample-contract-id',
          payload: { courseId: 'c1', instructor: '0xabc' },
          rawTopicXdr: 'AAAA',
          rawValueXdr: 'AAAA',
          successfulCall: true,
          applicationOrder: 0,
        },
      ],
    }));

    const result = await service.verify({
      provider,
      transactionHash: HASH,
      eventName: EVENT_NAME_TOPIC,
      contractId: 'sample-contract-id',
      expectedPayload: { courseId: 'c1', instructor: '0xabc' },
    });

    expect(result.outcome).toBe(SorobanVerificationOutcome.VERIFIED);
    expect(result.verified).toBe(true);
    expect(result.ledgerSeq).toBe(42);

    const stored = await dataSource
      .getRepository(SorobanVerificationRecord)
      .findOne({ where: { transactionHash: HASH } });
    expect(stored).toMatchObject({
      transactionHash: HASH,
      outcome: SorobanVerificationOutcome.VERIFIED,
      verified: true,
      ledgerSeq: 42,
      eventName: EVENT_NAME_TOPIC,
    });
  });

  it('does not require a payload to verify a matching event', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'SUCCESS',
      ledger: 3,
      events: [{ eventName: EVENT_NAME_TOPIC, successfulCall: true, applicationOrder: 0 }],
    }));

    const result = await service.verify({
      provider,
      transactionHash: HASH,
      eventName: EVENT_NAME_TOPIC,
    });

    expect(result.outcome).toBe(SorobanVerificationOutcome.VERIFIED);
    expect(result.verified).toBe(true);
  });

  it('reports mismatch when the business fields no longer match', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'SUCCESS',
      ledger: 42,
      events: [
        {
          eventName: EVENT_NAME_TOPIC,
          contractId: 'sample-contract-id',
          payload: { courseId: 'c99' },
          successfulCall: true,
          applicationOrder: 0,
        },
      ],
    }));

    const result = await service.verify({
      provider,
      transactionHash: HASH,
      eventName: EVENT_NAME_TOPIC,
      expectedPayload: { courseId: 'c1' },
    });

    expect(result.outcome).toBe(SorobanVerificationOutcome.MISMATCH);
    expect(result.verified).toBe(false);

    const stored = await dataSource
      .getRepository(SorobanVerificationRecord)
      .findOne({ where: { transactionHash: HASH } });
    expect(stored).toMatchObject({ outcome: SorobanVerificationOutcome.MISMATCH, verified: false });
  });

  it('reports reverted (FAILED) distinctly from a not-found transaction', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'FAILED',
      ledgerSeq: 41,
      resultCode: 'txv_bad_auth',
      events: [],
    }));

    const result = await service.verify({
      provider,
      transactionHash: HASH,
      eventName: EVENT_NAME_TOPIC,
    });

    expect(result.outcome).toBe(SorobanVerificationOutcome.REVERTED);
    expect(result.verified).toBe(false);
    expect(result.ledgerSeq).toBe(41);
    expect(result.detail).toContain('txv_bad_auth');
  });

  it('treats a not-yet-confirmed (NOT_FOUND) transaction as transient', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'NOT_FOUND',
      events: [],
    }));

    await expect(
      service.verify({ provider, transactionHash: HASH, eventName: EVENT_NAME_TOPIC }),
    ).rejects.toBeInstanceOf(SorobanTransactionNotFoundError);

    // No row is persisted for a transient failure.
    const rows = await dataSource.getRepository(SorobanVerificationRecord).count();
    expect(rows).toBe(0);
  });

  it('throws provider-not-configured as a configured failure', async () => {
    await expect(
      service.verify({ provider: null, transactionHash: HASH, eventName: EVENT_NAME_TOPIC }),
    ).rejects.toThrow(/Provider not configured for network stellar/);
  });

  it('re-verification updates the existing row instead of duplicating it', async () => {
    const provider = providerReturning(async () => ({
      transactionHash: HASH,
      status: 'SUCCESS',
      ledger: 42,
      events: [{ eventName: EVENT_NAME_TOPIC, successfulCall: true, applicationOrder: 0 }],
    }));

    await service.verify({ provider, transactionHash: HASH, eventName: EVENT_NAME_TOPIC });
    await service.verify({ provider, transactionHash: HASH, eventName: EVENT_NAME_TOPIC });

    const rows = await dataSource.getRepository(SorobanVerificationRecord).count();
    expect(rows).toBe(1);
  });
});

describe('sorobanPayloadsEqual', () => {
  it('compares plain objects order-insensitively', () => {
    expect(sorobanPayloadsEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
  });

  it('rejects different values', () => {
    expect(sorobanPayloadsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('compares primitives by value', () => {
    expect(sorobanPayloadsEqual('s', 's')).toBe(true);
    expect(sorobanPayloadsEqual('s', 't')).toBe(false);
  });

  it('treats null/undefined as non-equal unless both are', () => {
    expect(sorobanPayloadsEqual(null, null)).toBe(true);
    expect(sorobanPayloadsEqual({ a: 1 }, null)).toBe(false);
  });
});
