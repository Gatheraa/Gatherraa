import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness probe — always returns 200 while the process is alive. */
  @Get('healthz')
  healthz(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe — returns 200 only when all downstream dependencies
   * (DB) are reachable. Returns 503 otherwise so load-balancers stop routing.
   */
  @Get('readyz')
  async readyz(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    // Database check
    try {
      await this.dataSource.query('SELECT 1');
      checks['database'] = 'ok';
    } catch {
      checks['database'] = 'unreachable';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    if (!allOk) {
      throw new ServiceUnavailableException({ status: 'error', checks });
    }
    return { status: 'ok', checks };
  }
}
