import { Migration } from './migration.interface';

const migration: Migration = {
  id: '003-create-soroban-traces',
  description: 'Create soroban_traces table with unique source identity',
  up: async (qr) => {
    await qr.query(`
      CREATE TABLE soroban_traces (
        id TEXT PRIMARY KEY,
        transactionHash TEXT NOT NULL,
        ledgerSeq INTEGER NOT NULL,
        eventIndex INTEGER NOT NULL,
        eventName TEXT NOT NULL,
        eventPayload TEXT NOT NULL,
        rawXdr TEXT NOT NULL,
        successfulCall INTEGER NOT NULL,
        applicationOrder INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // The deduplication invariant: exactly one row per source identity across
    // retries and concurrent workers. This backs the idempotent ingest no-op.
    await qr.query(
      `CREATE UNIQUE INDEX idx_soroban_traces_identity ON soroban_traces(transactionHash, ledgerSeq, eventIndex)`,
    );

    // Ordered read path: a transaction's traces in on-chain emission order.
    await qr.query(
      `CREATE INDEX idx_soroban_traces_tx_order ON soroban_traces(transactionHash, applicationOrder, eventIndex)`,
    );
  },
  down: async (qr) => {
    await qr.query(`DROP INDEX idx_soroban_traces_tx_order`);
    await qr.query(`DROP INDEX idx_soroban_traces_identity`);
    await qr.query(`DROP TABLE soroban_traces`);
  },
};

export default migration;
