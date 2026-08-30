import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Durable, deduplicated, transaction-ordered store for extracted Soroban
 * traces (issue #712).
 *
 * The stable source identity is the tuple `(transactionHash, ledgerSeq,
 * eventIndex)`, backed by a real unique index held in
 * `003-create-soroban-traces`. Writing a record whose identity is already
 * present is a no-op, never a duplicate or an error, so a retried job or a
 * concurrent worker writing the same transaction produces exactly one row.
 *
 * Traces from one transaction are returned in `applicationOrder`, preserving
 * the on-chain emission order regardless of the order the queue writes them.
 */
@Entity('soroban_traces')
@Index(['transactionHash', 'ledgerSeq', 'eventIndex'], { unique: true })
@Index(['transactionHash', 'applicationOrder', 'eventIndex'])
export class SorobanTrace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Parent transaction hash (part of the source identity). */
  @Column({ type: 'varchar', length: 128 })
  transactionHash: string;

  /** Ledger sequence the transaction was applied on (part of the identity). */
  @Column({ type: 'int' })
  ledgerSeq: number;

  /** Position of the event within the transaction's events array (identity). */
  @Column({ type: 'int' })
  eventIndex: number;

  /** Decoded LMS event name (e.g. `course_created`), normalized for querying. */
  @Column({ type: 'varchar', length: 128 })
  eventName: string;

  /** Typed event fields, stored normalized so consumers need not parse XDR. */
  @Column({ type: 'simple-json' })
  eventPayload: Record<string, unknown>;

  /** Raw base64 `DiagnosticEvent` XDR, retained verbatim for audit/re-verify. */
  @Column({ type: 'text' })
  rawXdr: string;

  /** Success classification of the enclosing contract call (#709). */
  @Column({ type: 'boolean' })
  successfulCall: boolean;

  /** Application (Soroban) order within the transaction, for read ordering. */
  @Column({ type: 'int' })
  applicationOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
