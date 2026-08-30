// Durable Soroban verification record (issue #713).
//
// One row per transaction. The `transactionHash` is the primary key so
// re-verifying an already-verified trace updates the existing row instead of
// duplicating it. This is the self-contained, portable analog of "a
// verification-status field on the trace row": it records the outcome, the
// verified flag, and the ledger sequence at which the fact was established so
// it survives a process restart.

import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum SorobanVerificationOutcome {
  VERIFIED = 'verified',
  REVERTED = 'reverted',
  MISMATCH = 'mismatch',
}

@Entity('soroban_verifications')
export class SorobanVerificationRecord {
  @PrimaryColumn({ type: 'varchar', length: 66 })
  transactionHash: string;

  @Column({ type: 'varchar', length: 16 })
  outcome: SorobanVerificationOutcome;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'integer', nullable: true })
  ledgerSeq?: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  eventName?: string | null;

  @Column({ type: 'text', nullable: true })
  detail?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
