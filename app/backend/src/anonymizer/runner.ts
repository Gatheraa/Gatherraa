import 'dotenv/config';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';

const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';
const dataSource = new DataSource({ type: 'sqlite', database: DB_PATH });

function maskEmail(email: string) {
  if (!email) return email;
  const parts = email.split('@');
  const name = parts[0];
  const domain = parts[1] || '';
  const keep = Math.max(1, Math.floor(name.length / 3));
  return name.substring(0, keep) + '***' + '@' + domain;
}

async function anonymizeEmailTemplates() {
  const repo = dataSource.getRepository('email_templates');
  const rows: any[] = await dataSource.query(`SELECT id, fromEmail, fromName, htmlContent FROM email_templates`);
  for (const r of rows) {
    await dataSource.query(`UPDATE email_templates SET fromEmail = ?, fromName = ?, htmlContent = ? WHERE id = ?`, [
      maskEmail(r.fromEmail),
      faker.name.firstName(),
      '<p>[REDACTED]</p>',
      r.id,
    ]);
  }
}

async function run() {
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_ANONYMIZE) {
    console.error('Anonymization only allowed in production or with FORCE_ANONYMIZE=1');
    process.exit(1);
  }
  await dataSource.initialize();
  console.log('Starting anonymization...');
  await anonymizeEmailTemplates();
  console.log('Anonymization completed');
  await dataSource.destroy();
}

if (require.main === module) run().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
