import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const dbConfig = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true, // dev only
};

@Injectable()
export class TenantConnectionService {
  private connections: { [key: string]: DataSource } = {};

  async getConnection(tenantId: string): Promise<DataSource> {
    if (!this.connections[tenantId]) {
      const dataSource = new DataSource({
        ...dbConfig,
        schema: tenantId, // schema-per-tenant
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      });
      await dataSource.initialize();
      this.connections[tenantId] = dataSource;
    }
    return this.connections[tenantId];
  }
}