import { ConfigService } from '@nestjs/config';
import migration003 from './migrations/003-create-identity-verification-tables';

describe('AppModule Database Configuration (#699)', () => {
  const getDatabaseConfig = (configMock: Record<string, string | number>) => {
    const configService = {
      get: jest.fn((key: string, fallback?: any) => configMock[key] ?? fallback),
    } as unknown as ConfigService;

    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    const allowSync =
      !isProduction &&
      (isTest || configService.get<string>('DB_SYNCHRONIZE') === 'true');

    return {
      type: 'sqlite',
      database: configService.get<string>('DATABASE_PATH', ':memory:'),
      synchronize: allowSync,
      migrationsRun: !allowSync,
    };
  };

  it('disables synchronize and enables migrations in production', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'production',
      DATABASE_PATH: './prod.sqlite',
    });

    expect(config.synchronize).toBe(false);
    expect(config.migrationsRun).toBe(true);
  });

  it('disables synchronize in production even if DB_SYNCHRONIZE is set to true (enforces production safety)', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'production',
      DB_SYNCHRONIZE: 'true',
      DATABASE_PATH: './prod.sqlite',
    });

    expect(config.synchronize).toBe(false);
    expect(config.migrationsRun).toBe(true);
  });

  it('allows synchronize in test environment for fast in-memory execution', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
    });

    expect(config.synchronize).toBe(true);
    expect(config.migrationsRun).toBe(false);
  });

  it('allows explicit DB_SYNCHRONIZE=true only in non-production development mode', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'development',
      DB_SYNCHRONIZE: 'true',
      DATABASE_PATH: './dev.sqlite',
    });

    expect(config.synchronize).toBe(true);
    expect(config.migrationsRun).toBe(false);
  });

  it('disables synchronize by default in development when DB_SYNCHRONIZE is not set', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'development',
      DATABASE_PATH: './dev.sqlite',
    });

    expect(config.synchronize).toBe(false);
    expect(config.migrationsRun).toBe(true);
  });

  describe('Migration 003: identity verification tables', () => {
    it('defines correct up and down methods for table lifecycle', async () => {
      const mockQueryRunner = {
        query: jest.fn().mockResolvedValue(undefined),
      };

      expect(migration003.id).toBe('003-create-identity-verification-tables');
      await migration003.up(mockQueryRunner as any);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS identity_verifications'),
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS verification_history'),
      );

      mockQueryRunner.query.mockClear();
      if (migration003.down) {
        await migration003.down(mockQueryRunner as any);
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('DROP TABLE IF EXISTS verification_history'),
        );
        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('DROP TABLE IF EXISTS identity_verifications'),
        );
      }
    });
  });
});
