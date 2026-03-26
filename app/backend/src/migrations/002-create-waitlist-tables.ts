import { Migration } from './migration.interface';

const migration: Migration = {
    id: '002-create-waitlist-tables',
    description: 'Create waitlist_entries and waitlist_analytics tables',
    up: async (qr) => {
        // Create waitlist_entries table
        await qr.query(`
      CREATE TABLE waitlist_entries (
        id TEXT PRIMARY KEY,
        eventId TEXT NOT NULL,
        userId TEXT NOT NULL,
        priorityScore REAL NOT NULL DEFAULT 0,
        referralCode TEXT,
        referredBy TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        inviteSentAt TEXT,
        inviteExpiresAt TEXT,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referredBy) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

        // Create indexes for waitlist_entries
        await qr.query(\`CREATE INDEX idx_waitlist_entries_event_id ON waitlist_entries(eventId)\`);
    await qr.query(\`CREATE INDEX idx_waitlist_entries_user_id ON waitlist_entries(userId)\`);
    await qr.query(\`CREATE INDEX idx_waitlist_entries_status ON waitlist_entries(status)\`);
    await qr.query(\`CREATE INDEX idx_waitlist_entries_priority_score ON waitlist_entries(priorityScore DESC)\`);

    // Create waitlist_analytics table
    await qr.query(`
      CREATE TABLE waitlist_analytics(
            id TEXT PRIMARY KEY,
            eventId TEXT NOT NULL,
            totalWaitlisted INTEGER NOT NULL DEFAULT 0,
            totalInvited INTEGER NOT NULL DEFAULT 0,
            totalConverted INTEGER NOT NULL DEFAULT 0,
            totalExpired INTEGER NOT NULL DEFAULT 0,
            averageWaitTimeMinutes REAL NOT NULL DEFAULT 0,
            snapshotAt TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE
        )
            `);

    // Create index for waitlist_analytics
    await qr.query(\`CREATE INDEX idx_waitlist_analytics_event_id ON waitlist_analytics(eventId)\`);
  },
  down: async (qr) => {
    await qr.query(\`DROP TABLE waitlist_analytics\`);
    await qr.query(\`DROP TABLE waitlist_entries\`);
  },
};

export default migration;
