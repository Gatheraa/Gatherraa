// SorobanReplayService tests (issue #711)
//
// Proves backfill correctness against a real cursor DB: walks from a bounded
// `fromSeq` through the head, is idempotent on re-run, resumes from the cursor,
// absorbs overlapping backfill+live work, and never regresses.

import { DataSource } from 'typeorm';
import { ReplayCursor } from './entities/replay-cursor.entity';
import { ReplayCursorService } from './replay-cursor.service';
import { InMemoryTraceStore } from './in-memory-trace.store';
import { SorobanReplayService, SorobanTraceIngestPort } from './soroban-replay.service';
import { StellarProvider } from '../providers/stellar.provider';
import migration from '../../migrations/004-create-replay-cursors';

describe('SorobanReplayService', () => {
  let dataSource: DataSource;
  let cursorService: ReplayCursorService;
  let store: SorobanTraceIngestPort & { size: number };
  let replay: SorobanReplayService;

  // Stub provider: head at 5, ledger `l` emits one trace.
  const provider = {
    getLatestLedger: async () => ({ sequence: 5 }),
    eventsForLedger: async (_n: string, ledger: number) => [
      {
        transactionHash: `tx-${ledger}`,
        ledgerSeq: ledger,
        eventIndex: 0,
        eventName: 'course_created',
        eventPayload: { courseId: `c${ledger}` },
        rawXdr: 'AAAA',
        successfulCall: true,
        applicationOrder: 0,
      },
    ],
  } as unknown as StellarProvider;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [ReplayCursor],
      synchronize: false,
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    // Fresh cursor DB per test so cursor state never leaks between scenarios.
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.query('DROP TABLE IF EXISTS soroban_replay_cursors');
    await migration.up(qr);
    await qr.release();

    cursorService = new ReplayCursorService(dataSource.getRepository(ReplayCursor), dataSource);
    store = new InMemoryTraceStore();
    replay = new SorobanReplayService(cursorService, store, provider);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('ingests every ledger through the head with no gaps from an explicit fromSeq', async () => {
    const result = await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 5 });

    expect(result.processedLedgers).toBe(5);
    expect(result.ingested).toBe(5);
    expect(store.size).toBe(5);
    expect(result.cursor).toBe(5);
  });

  it('is idempotent when re-run over an already-covered range', async () => {
    await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 5 });
    const before = store.size;

    const again = await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 5 });

    // No new rows, no cursor regression.
    expect(store.size).toBe(before);
    expect(again.ingested).toBe(0); // every duplicate absorbed as a no-op
    expect(again.cursor).toBe(5);
  });

  it('resumes from the durable cursor when fromSeq is omitted', async () => {
    await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 3 });

    // A fresh service instance starts its backfill from the persisted cursor.
    const resuming = new SorobanReplayService(cursorService, store, provider);
    const result = await resuming.runBackfill({ networkId: 'stellar', toSeq: 5 });

    // Processed 4..5 (cursor was 3), not restarting at zero.
    expect(result.fromSeq).toBe(4);
    expect(result.processedLedgers).toBe(2);
    expect(result.cursor).toBe(5);
  });

  it('binds a backfill to a bounded range', async () => {
    const result = await replay.runBackfill({
      networkId: 'stellar',
      fromSeq: 1,
      toSeq: 5,
      batchSize: 2,
    });

    // Only the first two ledgers are processed in this invocation.
    expect(result.toSeq).toBe(2);
    expect(result.processedLedgers).toBe(2);
    expect(result.cursor).toBe(2);
  });

  it('absorbs overlapping backfill and live extraction without duplicating rows', async () => {
    // Live extraction writes ledgers 2..4 first (as if a live job had run).
    const live = new SorobanReplayService(cursorService, store, provider);
    await live.runBackfill({ networkId: 'stellar', fromSeq: 2, toSeq: 4 });
    const liveRows = store.size;

    // Backfill now walks the full range including the already-covered overlap.
    const backfill = await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 5 });

    // Exactly the union of ledgers, no duplicate rows for the overlap.
    expect(store.size).toBe(5);
    expect(backfill.ingested).toBe(5 - liveRows);
  });

  it('resumes from the cursor after an aborted mid-range run (crash)', async () => {
    // First invocation only gets through ledger 1 (batchSize 1).
    await replay.runBackfill({ networkId: 'stellar', fromSeq: 1, toSeq: 5, batchSize: 1 });
    expect(await cursorService.getCursor('stellar')).toBe(1);

    // Subsequent invocation resumes from 2, not from zero.
    const resumed = await replay.runBackfill({
      networkId: 'stellar',
      toSeq: 5,
      batchSize: 10,
    });
    expect(resumed.fromSeq).toBe(2);
    expect(resumed.cursor).toBe(5);
  });
});
