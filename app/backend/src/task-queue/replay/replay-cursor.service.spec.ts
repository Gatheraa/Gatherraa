// ReplayCursorService integration tests (issue #711)
//
// Proves the durable cursor advances atomically with a batch and never
// regresses, using a real in-memory SQLite DB backed by the `004` migration.

import { DataSource } from 'typeorm';
import { ReplayCursor } from './entities/replay-cursor.entity';
import { ReplayCursorService } from './replay-cursor.service';
import migration from '../../migrations/004-create-replay-cursors';

describe('ReplayCursorService (integration)', () => {
  let dataSource: DataSource;
  let service: ReplayCursorService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [ReplayCursor],
      synchronize: false,
    });
    await dataSource.initialize();
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await migration.up(qr);
    await qr.release();
    service = new ReplayCursorService(dataSource.getRepository(ReplayCursor), dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('defaults the cursor to 0 for a never-replayed network', async () => {
    await expect(service.getCursor('stellar')).resolves.toBe(0);
  });

  it('advances the cursor atomically with a batch', async () => {
    const advanced = await service.advanceWithBatch('stellar', 42, async () => {
      // Simulate durable ingestion of ledger 42 (commits with the cursor).
      await dataSource.query(
        `INSERT OR REPLACE INTO soroban_replay_cursors (networkId, lastLedgerSeq, createdAt, updatedAt) VALUES ('stellar', 0, 'now', 'now')`,
      );
    });

    expect(advanced).toBe(42);
    await expect(service.getCursor('stellar')).resolves.toBe(42);
  });

  it('rolls back the cursor when the batch write fails (crash-at-cursor)', async () => {
    // Cursor is at 42 from the previous test.
    await expect(
      service.advanceWithBatch('stellar', 100, async () => {
        throw new Error('simulated crash before cursor advance');
      }),
    ).rejects.toThrow('simulated crash');

    // The cursor must not have advanced past the actually-saved ledger.
    await expect(service.getCursor('stellar')).resolves.toBe(42);
  });

  it('never regresses the cursor below the current watermark', async () => {
    const advanced = await service.advanceWithBatch('stellar', 10, async () => {});
    // 10 < current 42, so the cursor stays at 42 (monotonic).
    expect(advanced).toBe(42);
    await expect(service.getCursor('stellar')).resolves.toBe(42);
  });

  it('tracks cursors independently per network id', async () => {
    await service.advanceWithBatch('stellar-testnet', 7, async () => {});
    await expect(service.getCursor('stellar-testnet')).resolves.toBe(7);
    await expect(service.getCursor('stellar')).resolves.toBe(42);
  });

  it('returns a resume point matching the persisted cursor', async () => {
    await expect(service.resumeFrom('stellar-testnet')).resolves.toBe(7);
  });
});
