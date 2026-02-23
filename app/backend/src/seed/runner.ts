import 'dotenv/config';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { EmailTemplate } from '../email/entities/email-template.entity';

const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

const dataSource = new DataSource({ type: 'sqlite', database: DB_PATH, entities: [EmailTemplate], synchronize: false });

async function run() {
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
    console.error('Refusing to seed in production without FORCE_SEED=1');
    process.exit(1);
  }

  await dataSource.initialize();
  const repo = dataSource.getRepository(EmailTemplate);

  console.log('Seeding sample EmailTemplates...');
  for (let i = 0; i < 5; i++) {
    const t = repo.create({
      id: undefined as any,
      name: `seeded-template-${Date.now()}-${i}`,
      language: 'en',
      subject: faker.lorem.sentence(),
      htmlContent: `<p>${faker.lorem.paragraph()}</p>`,
      textContent: faker.lorem.paragraphs(),
      mjmlTemplate: null,
      type: 'TRANSACTIONAL',
      status: 'ACTIVE',
      description: faker.lorem.sentence(),
      requiredVariables: ['name'],
      version: 1,
      fromEmail: faker.internet.email(),
      fromName: faker.name.fullName(),
      replyToEmails: [],
      ccEmails: [],
      bccEmails: [],
      tags: 'seed',
      viewCount: 0,
      clickCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Partial<EmailTemplate> as EmailTemplate);
    await repo.save(t);
    console.log('Inserted', t.name);
  }

  await dataSource.destroy();
  console.log('Seeding completed.');
}

if (require.main === module) run().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
