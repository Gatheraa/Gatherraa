import { Migration } from './migration.interface';

const migration: Migration = {
  id: '001-add-archivedAt-email-templates',
  description: 'Add archivedAt column to email_templates and set for ARCHIVED',
  up: async (qr) => {
    // add column if not exists (sqlite syntax)
    await qr.query(`ALTER TABLE email_templates ADD COLUMN archivedAt TEXT`);
    // set archivedAt where status = 'ARCHIVED'
    await qr.query(`UPDATE email_templates SET archivedAt = datetime('now') WHERE status = 'ARCHIVED'`);
  },
  down: async (qr) => {
    // SQLite doesn't support DROP COLUMN; for demo purposes we'll create a new table without the column
    await qr.query(`CREATE TABLE email_templates_new AS SELECT id, name, language, subject, htmlContent, textContent, mjmlTemplate, type, status, description, requiredVariables, version, fromEmail, fromName, replyToEmails, ccEmails, bccEmails, tags, viewCount, clickCount, createdAt, updatedAt FROM email_templates`);
    await qr.query(`DROP TABLE email_templates`);
    await qr.query(`ALTER TABLE email_templates_new RENAME TO email_templates`);
  },
};

export default migration;
