// SorobanTraceService integration tests (issue #712)
//
// Uses a real in-memory SQLite database backed by the `003-create-soroban-traces`
// migration so the unique index and ordering guarantees are proven against an
// actual constraint, not a mock.

import { DataSource } from 'typeorm';
import { SorobanTrace } from './entities/soroban-trace.entity';
import { SorobanTraceService, SorobanTraceIngestInput } from './soroban-trace.service';
import migration from '../migrations/003-create-soroban-traces';

describe('SorobanTraceService (integration)', () => {
  let dataSource: DataSource;
  let service: SorobanTraceService;

  const baseInput = (
    overrides: Partial<SorobanTraceIngestInput> = {},
  ): SorobanTraceIngestInput => ({
    transactionHash: 'tx-abc',
    ledgerSeq: 100,
    eventIndex: 0,
    eventName: 'course_created',
    eventPayload: { courseId: 'c1', title: 'Stellar 101' },
    rawXdr: 'AAAAAXhz',
    successfulCall: true,
    applicationOrder: 0,
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [SorobanTrace],
      synchronize: false,
    });
    await dataSource.initialize();

    // Apply the real migration so the table and unique index exist.
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await migration.up(qr);
    await qr.release();

    service = new SorobanTraceService(dataSource.getRepository(SorobanTrace));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('stores a trace and reports inserted=true', async () => {
    const result = await service.ingest(baseInput());
    expect(result.inserted).toBe(true);
    expect(result.record.transactionHash).toBe('tx-abc');
    expect(result.record.eventName).toBe('course_created');
    expect(result.record.eventPayload.courseId).toBe('c1');

    const count = await dataSource.getRepository(SorobanTrace).count();
    expect(count).toBe(1);
  });

  it('is idempotent: re-ingesting the same source identity is a no-op, not an error', async () => {
    const first = await service.ingest(baseInput({ transactionHash: 'tx-idem' }));
    expect(first.inserted).toBe(true);

    const second = await service.ingest(baseInput({ transactionHash: 'tx-idem' }));
    expect(second.inserted).toBe(false);
    expect(second.record.id).toBe(first.record.id);

    // Exactly one row despite two writes.
    const count = await dataSource
      .getRepository(SorobanTrace)
      .count({ where: { transactionHash: 'tx-idem' } });
    expect(count).toBe(1);
  });

  it('treats a concurrent duplicate write as a no-op, producing exactly one row', async () => {
    // Two service instances racing to write the same transaction.
    const other = new SorobanTraceService(dataSource.getRepository(SorobanTrace));

    const results = await Promise.all([
      service.ingest(baseInput({ transactionHash: 'tx-race', eventIndex: 0 })),
      other.ingest(baseInput({ transactionHash: 'tx-race', eventIndex: 0 })),
    ]);

    const insertedCount = results.filter((r) => r.inserted).length;
    expect(insertedCount).toBe(1);

    const rows = await dataSource
      .getRepository(SorobanTrace)
      .find({ where: { transactionHash: 'tx-race' } });
    expect(rows).toHaveLength(1);
  });

  it('returns a transaction traces strictly in applicationOrder regardless of write order', async () => {
    const tx = 'tx-ordered';
    // Write in deliberately wrong order (2 then 0 then 1).
    await service.ingest(baseInput({ transactionHash: tx, eventIndex: 2, applicationOrder: 2 }));
    await service.ingest(baseInput({ transactionHash: tx, eventIndex: 0, applicationOrder: 0 }));
    await service.ingest(baseInput({ transactionHash: tx, eventIndex: 1, applicationOrder: 1 }));

    const traces = await service.findByTransaction(tx);
    expect(traces.map((t) => t.applicationOrder)).toEqual([0, 1, 2]);
    expect(traces.map((t) => t.eventIndex)).toEqual([0, 1, 2]);
  });

  it('reports exists() correctly for present and absent identities', async () => {
    await service.ingest(baseInput({ transactionHash: 'tx-exists' }));
    await expect(
      service.exists({ transactionHash: 'tx-exists', ledgerSeq: 100, eventIndex: 0 }),
    ).resolves.toBe(true);
    await expect(
      service.exists({ transactionHash: 'tx-exists', ledgerSeq: 100, eventIndex: 5 }),
    ).resolves.toBe(false);
  });
});
