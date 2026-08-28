import { Migration } from './migration.interface';

const migration: Migration = {
  id: '003-create-identity-verification-tables',
  description: 'Create identity_verifications and verification_history tables',
  up: async (qr) => {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS identity_verifications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        step TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT,
        rejectionReason TEXT,
        attemptCount INTEGER NOT NULL DEFAULT 0,
        maxAttempts INTEGER NOT NULL DEFAULT 3,
        isRequired INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME
      );
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS IDX_identity_verifications_userId
      ON identity_verifications (userId);
    `);
    await qr.query(`
      CREATE TABLE IF NOT EXISTS verification_history (
        id TEXT PRIMARY KEY,
        verificationId TEXT NOT NULL,
        action TEXT NOT NULL,
        message TEXT,
        metadata TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (verificationId) REFERENCES identity_verifications(id) ON DELETE CASCADE
      );
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS IDX_verification_history_verificationId
      ON verification_history (verificationId);
    `);
  },
  down: async (qr) => {
    await qr.query(`DROP TABLE IF EXISTS verification_history;`);
    await qr.query(`DROP TABLE IF EXISTS identity_verifications;`);
  },
};

export default migration;
