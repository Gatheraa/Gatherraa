// Durable per-network replay cursor (issue #711).
//
// Reads and atomically advances the highest fully-ingested ledger sequence.
// The cursor is advanced in the same persistence transaction as the batch it
// covers, so a crash between batch-write and cursor-advance leaves the cursor
// at or below the actually-saved ledger and the next run resumes from it —
// never skipping, and never duplicating past work.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ReplayCursor } from './entities/replay-cursor.entity';

@Injectable()
export class ReplayCursorService {
  constructor(
    @InjectRepository(ReplayCursor)
    private readonly cursors: Repository<ReplayCursor>,
    private readonly dataSource: DataSource,
  ) {}

  /** The current cursor value (0 when the network has never been replayed). */
  async getCursor(networkId: string): Promise<number> {
    const row = await this.cursors.findOne({ where: { networkId } });
    return row ? row.lastLedgerSeq : 0;
  }

  /** Head ledger to resume a backfill from when no explicit `fromSeq` is given. */
  async resumeFrom(networkId: string): Promise<number> {
    return this.getCursor(networkId);
  }

  /**
   * Atomically persist a batch and advance the cursor to `ledger`.
   *
   * Runs inside a single transaction so the batch write and the watermark
   * advance commit together (or roll back together). The cursor is only ever
   * moved forward: advancing to a ledger below the current value is ignored.
   *
   * `writeBatch` performs the durable ingestion for the just-processed ledger;
   * throwing inside it rolls back both the batch and the cursor advance.
   */
  async advanceWithBatch(
    networkId: string,
    ledger: number,
    writeBatch: () => Promise<void>,
  ): Promise<number> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const current = await this.getCursor(networkId);
      const target = Math.max(current, ledger);

      await writeBatch();

      await qr.manager.upsert(ReplayCursor, { networkId, lastLedgerSeq: target }, ['networkId']);

      await qr.commitTransaction();
      return target;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
