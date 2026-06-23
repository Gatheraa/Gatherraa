import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health probes (e2e)', () => {
  let app: INestApplication;
  const originalEnv = { ...process.env };

  afterEach(async () => {
    await app?.close();
    process.env = { ...originalEnv };
  });

  async function createApp() {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }

  it('returns liveness without checking dependencies', async () => {
    await createApp();

    const response = await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('treats unconfigured dependencies as skipped outside production', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.QUEUE_REDIS_URL;
    delete process.env.QUEUE_REDIS_HOST;
    process.env.NODE_ENV = 'test';
    await createApp();

    const response = await request(app.getHttpServer()).get('/readyz').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.status).toBe('skipped');
    expect(response.body.checks.redis.status).toBe('skipped');
    expect(response.body.checks.queue.status).toBe('skipped');
  });

  it('fails readiness when a required dependency is unreachable', async () => {
    process.env.NODE_ENV = 'test';
    process.env.HEALTH_READINESS_CHECKS = 'redis';
    process.env.HEALTH_READINESS_TIMEOUT_MS = '50';
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    await createApp();

    const response = await request(app.getHttpServer()).get('/readyz').expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.checks.redis.status).toBe('failed');
    expect(response.body.checks.redis.required).toBe(true);
  });

  it('requires dependency configuration in production', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.QUEUE_REDIS_URL;
    delete process.env.QUEUE_REDIS_HOST;
    delete process.env.HEALTH_READINESS_CHECKS;
    process.env.NODE_ENV = 'production';
    await createApp();

    const response = await request(app.getHttpServer()).get('/readyz').expect(503);

    expect(response.body.status).toBe('error');
    expect(response.body.checks.database.reason).toBe('missing_config');
    expect(response.body.checks.redis.reason).toBe('missing_config');
    expect(response.body.checks.queue.reason).toBe('missing_config');
  });
});
