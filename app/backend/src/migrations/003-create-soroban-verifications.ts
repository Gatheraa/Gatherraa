import { Migration } from './migration.interface';

const migration: Migration = {
  id: '003-create-soroban-verifications',
  description:
    'Create soroban_verifications table recording durable Soroban verification outcomes keyed by transactionHash',
  up: async (qr) => {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS soroban_verifications (
        transactionHash TEXT PRIMARY KEY,
        outcome TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        ledgerSeq INTEGER,
        eventName TEXT,
        detail TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    await qr.query(
      `CREATE INDEX IF NOT EXISTS idx_soroban_verifications_outcome ON soroban_verifications(outcome)`,
    );
  },
  down: async (qr) => {
    await qr.query(`DROP TABLE IF EXISTS soroban_verifications`);
  },
};

export default migration;
