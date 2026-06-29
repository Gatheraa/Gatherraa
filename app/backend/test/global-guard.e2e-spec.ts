import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { Public } from '../src/auth/decorators/public.decorator';

@Controller('test-global-guard')
class TestGlobalGuardController {
  @Get('protected')
  getProtected() {
    return 'Protected Resource';
  }

  @Public()
  @Get('public')
  getPublic() {
    return 'Public Resource';
  }
}

describe('Global JwtAuthGuard (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestGlobalGuardController],
    }).compile();

    app = moduleFixture.createNestApplication();
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new JwtAuthGuard(reflector));
    await app.init();
  });

  it('/test-global-guard/protected (GET) - should fail with 401 without JWT', () => {
    return request(app.getHttpServer())
      .get('/test-global-guard/protected')
      .expect(401);
  });

  it('/test-global-guard/public (GET) - should pass with @Public()', () => {
    return request(app.getHttpServer())
      .get('/test-global-guard/public')
      .expect(200)
      .expect('Public Resource');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
