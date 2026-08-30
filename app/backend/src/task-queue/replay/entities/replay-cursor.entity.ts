import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Durable replay cursor for Soroban trace backfill (issue #711).
 *
 * Keyed by network id, it stores the highest ledger sequence whose traces are
 * all durably stored. The cursor is advanced in the same persistence
 * transaction as the batch it covers, so a crash between batch-write and
 * cursor-advance leaves the cursor at or below the actually-saved ledger and
 * the next run re-processes (idempotently) without skipping or duplicating.
 */
@Entity('soroban_replay_cursors')
export class ReplayCursor {
  /** Network id the cursor is authoritative for (e.g. `stellar`). */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  networkId: string;

  /** Highest fully-ingested ledger sequence. */
  @Column({ type: 'bigint', default: 0 })
  lastLedgerSeq: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
