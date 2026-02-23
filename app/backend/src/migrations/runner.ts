import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Migration } from './migration.interface';

const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

const dataSource = new DataSource({
  type: 'sqlite',
  database: DB_PATH,
});

async function ensureMigrationTable() {
  await dataSource.query(
    `CREATE TABLE IF NOT EXISTS migrations_history (id TEXT PRIMARY KEY, description TEXT, run_at TEXT)`,
  );
}

function loadMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname);
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.match(/^\d+.*\.ts$/) || f.match(/^\d+.*\.js$/))
    .map((file) => require(path.join(migrationsDir, file)).default)
    .filter(Boolean)
    .sort((a: Migration, b: Migration) => (a.id > b.id ? 1 : -1));
}

async function getApplied(): Promise<Set<string>> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `SELECT id FROM migrations_history`,
  );
  return new Set(rows.map((r) => r.id));
}

async function run() {
  await dataSource.initialize();
  await ensureMigrationTable();
  const migrations = loadMigrations();
  const applied = await getApplied();

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    if (m.dependencies && m.dependencies.some((d) => !applied.has(d))) {
      throw new Error(`Migration ${m.id} has unmet dependencies: ${m.dependencies}`);
    }
    console.log(`Running migration ${m.id} - ${m.description || ''}`);
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await m.up(queryRunner);
      await queryRunner.commitTransaction();
      await dataSource.query(`INSERT INTO migrations_history(id, description, run_at) VALUES(?, ?, datetime('now'))`, [
        m.id,
        m.description || null,
      ]);
      console.log(`Applied ${m.id}`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error(`Failed migration ${m.id}:`, err);
      process.exit(1);
    } finally {
      await queryRunner.release();
    }
  }
  await dataSource.destroy();
}

async function revert() {
  await dataSource.initialize();
  await ensureMigrationTable();
  const migrations = loadMigrations().reverse();
  const applied = await getApplied();

  for (const m of migrations) {
    if (!applied.has(m.id)) continue;
    if (!m.down) {
      console.warn(`Migration ${m.id} has no down() — skipping`);
      continue;
    }
    console.log(`Reverting migration ${m.id}`);
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await m.down(queryRunner);
      await queryRunner.commitTransaction();
      await dataSource.query(`DELETE FROM migrations_history WHERE id = ?`, [m.id]);
      console.log(`Reverted ${m.id}`);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error(`Failed revert ${m.id}:`, err);
      process.exit(1);
    } finally {
      await queryRunner.release();
    }
  }
  await dataSource.destroy();
}

async function dryRun() {
  const migrations = loadMigrations();
  const applied = await dataSource.initialize().then(() => ensureMigrationTable()).then(() => getApplied()).finally(() => dataSource.destroy());
  console.log('DRY RUN: pending migrations:');
  migrations.forEach((m) => {
    if (!applied.has(m.id)) console.log(`- ${m.id}: ${m.description || ''}`);
  });
}

async function main() {
  const cmd = process.argv[2] || 'run';
  if (cmd === 'run') await run();
  else if (cmd === 'revert') await revert();
  else if (cmd === 'dry-run') await dryRun();
  else {
    console.error('Unknown command. Use run|revert|dry-run');
    process.exit(2);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export {};
