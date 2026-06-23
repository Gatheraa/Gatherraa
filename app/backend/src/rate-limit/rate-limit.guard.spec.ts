import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RateLimit, SkipRateLimit } from './rate-limit.decorator';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimitModule } from './rate-limit.module';

@Controller('rate-limit-test')
class RateLimitTestController {
  @Get('limited')
  @RateLimit({
    limit: 2,
    windowMs: 60_000,
    strategy: 'ip',
    message: 'Test route limit exceeded.',
  })
  limited() {
    return { ok: true };
  }

  @Get('default')
  defaultLimited() {
    return { ok: true };
  }

  @Get('skip')
  @SkipRateLimit()
  skipped() {
    return { ok: true };
  }
}

describe('RateLimitGuard', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [RateLimitTestController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(app.get(RateLimitGuard));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('enforces per-route limits and exposes retry headers', async () => {
    const server = app.getHttpServer();

    await request(server)
      .get('/rate-limit-test/limited')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200)
      .expect('X-RateLimit-Limit', '2')
      .expect('X-RateLimit-Remaining', '1');

    await request(server)
      .get('/rate-limit-test/limited')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200)
      .expect('X-RateLimit-Remaining', '0');

    const blocked = await request(server)
      .get('/rate-limit-test/limited')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: 'Test route limit exceeded.',
    });
  });

  it('applies the default API policy to undecorated routes', async () => {
    await request(app.getHttpServer())
      .get('/rate-limit-test/default')
      .set('X-Forwarded-For', '203.0.113.11')
      .expect(200)
      .expect('X-RateLimit-Limit', '60')
      .expect('X-RateLimit-Remaining', '59');
  });

  it('allows routes to opt out explicitly', async () => {
    await request(app.getHttpServer())
      .get('/rate-limit-test/skip')
      .set('X-Forwarded-For', '203.0.113.12')
      .expect(200)
      .expect((response) => {
        expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      });
  });

  it('still enforces decorator limits without a global guard', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [RateLimitTestController],
    }).compile();
    const decoratorOnlyApp = moduleRef.createNestApplication();
    await decoratorOnlyApp.init();

    try {
      const server = decoratorOnlyApp.getHttpServer();

      await request(server)
        .get('/rate-limit-test/limited')
        .set('X-Forwarded-For', '203.0.113.13')
        .expect(200)
        .expect('X-RateLimit-Remaining', '1');

      await request(server)
        .get('/rate-limit-test/limited')
        .set('X-Forwarded-For', '203.0.113.13')
        .expect(200)
        .expect('X-RateLimit-Remaining', '0');

      await request(server)
        .get('/rate-limit-test/limited')
        .set('X-Forwarded-For', '203.0.113.13')
        .expect(429);
    } finally {
      await decoratorOnlyApp.close();
    }
  });
});
