import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'net';

type CheckName = 'database' | 'redis' | 'queue';
type CheckStatus = 'ok' | 'failed' | 'skipped';

interface DependencyTarget {
  host: string;
  port: number;
  label: string;
}

export interface DependencyCheck {
  status: CheckStatus;
  required: boolean;
  target?: string;
  latencyMs?: number;
  reason?: string;
}

export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  durationMs: number;
  checks: Record<CheckName, DependencyCheck>;
}

@Injectable()
export class HealthService {
  private readonly checkNames: CheckName[] = ['database', 'redis', 'queue'];

  constructor(private readonly configService: ConfigService) {}

  getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const startedAt = Date.now();
    const entries = await Promise.all(
      this.checkNames.map(async (name) => [name, await this.checkDependency(name)] as const),
    );
    const checks = Object.fromEntries(entries) as Record<CheckName, DependencyCheck>;
    const isReady = Object.values(checks).every((check) => check.status !== 'failed');

    return {
      status: isReady ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      durationMs: Date.now() - startedAt,
      checks,
    };
  }

  private async checkDependency(name: CheckName): Promise<DependencyCheck> {
    const target = this.getTarget(name);
    const required = this.isRequired(name, target);

    if (!target) {
      return {
        status: required ? 'failed' : 'skipped',
        required,
        reason: required ? 'missing_config' : 'not_configured',
      };
    }

    return this.checkTcpTarget(target, required);
  }

  private isRequired(name: CheckName, target?: DependencyTarget): boolean {
    const explicitChecks = this.getExplicitChecks();

    if (explicitChecks) {
      return explicitChecks.includes(name);
    }

    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return true;
    }

    return Boolean(target);
  }

  private getExplicitChecks(): CheckName[] | undefined {
    const value = this.configService.get<string>('HEALTH_READINESS_CHECKS');

    if (!value) {
      return undefined;
    }

    return value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part): part is CheckName => this.checkNames.includes(part as CheckName));
  }

  private getTarget(name: CheckName): DependencyTarget | undefined {
    if (name === 'database') {
      return (
        this.targetFromUrl('DATABASE_URL', 5432) ??
        this.targetFromHostPort('DB_HOST', 'DB_PORT', 5432) ??
        this.targetFromHostPort('DATABASE_HOST', 'DATABASE_PORT', 5432)
      );
    }

    if (name === 'queue') {
      return (
        this.targetFromUrl('QUEUE_REDIS_URL', 6379) ??
        this.targetFromHostPort('QUEUE_REDIS_HOST', 'QUEUE_REDIS_PORT', 6379) ??
        this.targetFromUrl('BULL_REDIS_URL', 6379) ??
        this.getRedisTarget()
      );
    }

    return this.getRedisTarget();
  }

  private getRedisTarget(): DependencyTarget | undefined {
    return (
      this.targetFromUrl('REDIS_URL', 6379) ??
      this.targetFromHostPort('REDIS_HOST', 'REDIS_PORT', 6379)
    );
  }

  private targetFromUrl(envName: string, defaultPort: number): DependencyTarget | undefined {
    const value = this.configService.get<string>(envName);

    if (!value) {
      return undefined;
    }

    try {
      const url = new URL(value);
      const port = Number(url.port || defaultPort);

      return {
        host: url.hostname,
        port,
        label: `${url.protocol}//${url.hostname}:${port}`,
      };
    } catch {
      return undefined;
    }
  }

  private targetFromHostPort(
    hostEnvName: string,
    portEnvName: string,
    defaultPort: number,
  ): DependencyTarget | undefined {
    const host = this.configService.get<string>(hostEnvName);

    if (!host) {
      return undefined;
    }

    const port = Number(this.configService.get<string>(portEnvName) || defaultPort);

    return {
      host,
      port,
      label: `${host}:${port}`,
    };
  }

  private checkTcpTarget(target: DependencyTarget, required: boolean): Promise<DependencyCheck> {
    const startedAt = Date.now();
    const timeoutMs = Number(this.configService.get<string>('HEALTH_READINESS_TIMEOUT_MS') || 1000);

    return new Promise((resolve) => {
      const socket = createConnection({ host: target.host, port: target.port });
      let settled = false;

      const finish = (check: DependencyCheck) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(check);
      };

      const timeout = setTimeout(() => {
        finish({
          status: 'failed',
          required,
          target: target.label,
          latencyMs: Date.now() - startedAt,
          reason: 'timeout',
        });
      }, timeoutMs);

      socket.once('connect', () => {
        clearTimeout(timeout);
        finish({
          status: 'ok',
          required,
          target: target.label,
          latencyMs: Date.now() - startedAt,
        });
      });

      socket.once('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        finish({
          status: 'failed',
          required,
          target: target.label,
          latencyMs: Date.now() - startedAt,
          reason: error.code || error.message,
        });
      });
    });
  }
}
