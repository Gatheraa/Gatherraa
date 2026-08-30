import { Migration } from './migration.interface';

const migration: Migration = {
  id: '004-create-replay-cursors',
  description: 'Create soroban_replay_cursors table for durable replay watermark',
  up: async (qr) => {
    await qr.query(`
      CREATE TABLE soroban_replay_cursors (
        networkId TEXT PRIMARY KEY,
        lastLedgerSeq INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  },
  down: async (qr) => {
    await qr.query(`DROP TABLE soroban_replay_cursors`);
  },
};

export default migration;
