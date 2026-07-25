import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RateLimitModule } from '../src/rate-limit/rate-limit.module';
import { RateLimitGuard } from '../src/rate-limit/guards/rate-limit.guard';
import { RateLimit, SkipRateLimit } from '../src/rate-limit/rate-limit.decorator';
import { Public } from '../src/auth/decorators/public.decorator';

@Controller('test-rate-limit')
class TestRateLimitController {
  @Public()
  @Get('default')
  getDefault() {
    return { success: true };
  }

  @Public()
  @RateLimit({ limit: 10, windowMs: 60000, strategy: 'ip' })
  @Get('strict')
  getStrict() {
    return { success: true };
  }

  @Public()
  @SkipRateLimit()
  @Get('unlimited')
  getUnlimited() {
    return { success: true };
  }
}

describe('RateLimitGuard (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, RateLimitModule],
      controllers: [TestRateLimitController],
    }).compile();

    app = moduleFixture.createNestApplication();
    const rateLimitGuard = app.get(RateLimitGuard);
    app.useGlobalGuards(rateLimitGuard);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. should include rate limit headers on allowed requests', async () => {
    const res = await request(app.getHttpServer())
      .get('/test-rate-limit/strict')
      .set('X-Forwarded-For', '203.0.113.199')
      .expect(200);

    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('2. should yield 429 Too Many Requests when 100 RPS burst exceeds threshold', async () => {
    const testIp = '198.51.100.55';
    // Limit for /test-rate-limit/strict is 10 requests
    const rpsBurst = 100;
    const results: number[] = [];

    // Send 100 requests sequentially / in parallel burst from the same IP
    for (let i = 0; i < rpsBurst; i++) {
      const res = await request(app.getHttpServer())
        .get('/test-rate-limit/strict')
        .set('X-Forwarded-For', testIp);

      results.push(res.status);
      if (res.status === 429) {
        expect(res.headers['retry-after']).toBeDefined();
        expect(res.headers['x-ratelimit-remaining']).toBe('0');
        expect(res.body.statusCode).toBe(429);
      }
    }

    const successCount = results.filter((status) => status === 200).length;
    const rateLimitedCount = results.filter((status) => status === 429).length;

    // First 10 requests succeed, remaining 90 yield 429
    expect(successCount).toBe(10);
    expect(rateLimitedCount).toBe(90);
  });

  it('3. should bypass rate limiting when @SkipRateLimit() is present', async () => {
    const testIp = '198.51.100.88';

    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer())
        .get('/test-rate-limit/unlimited')
        .set('X-Forwarded-For', testIp)
        .expect(200);
    }
  });

  it('4. should surface rate-limit metrics to Prometheus via /metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);

    expect(res.text).toContain('rate_limit_hits_total');
    expect(res.text).toContain('rate_limit_violations_total');
    expect(res.text).toContain('rate_limit_remaining');
  });
});
