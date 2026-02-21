import { Injectable } from '@nestjs/common';
import { Tenant } from './entities/tenant.entity';
import { TenantConnectionService } from './tenant-connection.service';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantService {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async createTenant(name: string, domain?: string): Promise<Tenant> {
    // 1. Connect to default DB
    const defaultDataSource = await this.tenantConnection.getConnection('public');
    const repo = defaultDataSource.getRepository(Tenant);

    // 2. Save tenant
    const tenant = repo.create({ name, domain });
    await repo.save(tenant);

    // 3. Create schema for tenant
    await defaultDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${name}"`);

    // 4. Initialize tenant schema (tables)
    const tenantConn = await this.tenantConnection.getConnection(name);
    await tenantConn.synchronize();

    return tenant;
  }

  async getTenantConfig(tenantId: string): Promise<Tenant> {
    const defaultDataSource = await this.tenantConnection.getConnection('public');
    return defaultDataSource.getRepository(Tenant).findOneBy({ name: tenantId });
  }
}