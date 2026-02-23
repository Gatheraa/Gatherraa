import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { Migration } from './migration.interface';

@Injectable()
export class MigrationStatusService {
  private dataSource: DataSource;
  constructor() {
    const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';
    this.dataSource = new DataSource({ type: 'sqlite', database: DB_PATH });
  }

  private loadMigrations(): Migration[] {
    const migrationsDir = path.join(__dirname);
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => f.match(/^\d+.*\.ts$/) || f.match(/^\d+.*\.js$/))
      .map((file) => require(path.join(migrationsDir, file)).default)
      .filter(Boolean)
      .sort((a: Migration, b: Migration) => (a.id > b.id ? 1 : -1));
  }

  async getStatus() {
    await this.dataSource.initialize();
    await this.dataSource.query(`CREATE TABLE IF NOT EXISTS migrations_history (id TEXT PRIMARY KEY, description TEXT, run_at TEXT)`);
    const rows: Array<{ id: string; description: string; run_at: string }> = await this.dataSource.query(`SELECT id, description, run_at FROM migrations_history ORDER BY run_at DESC`);
    const applied = new Set(rows.map((r) => r.id));
    const available = this.loadMigrations();
    const pending = available.filter((m) => !applied.has(m.id));
    await this.dataSource.destroy();
    return { applied: rows, pending: pending.map((p) => ({ id: p.id, description: p.description })) };
  }
}
