import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureAppSecurity } from './../src/security/app-security';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureAppSecurity(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('rejects cross-origin state-changing cookie requests without matching CSRF header', async () => {
    await request(app.getHttpServer())
      .post('/')
      .set('Origin', 'http://localhost:3001')
      .set('Cookie', ['access_token=session-cookie; csrf_token=trusted-token'])
      .send({ state: 'change' })
      .expect(403);
  });

  it('allows state-changing cookie requests when the CSRF cookie and header match', async () => {
    await request(app.getHttpServer())
      .post('/')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', ['access_token=session-cookie; csrf_token=trusted-token'])
      .set('X-CSRF-Token', 'trusted-token')
      .send({ state: 'change' })
      .expect(404);
  });
});
