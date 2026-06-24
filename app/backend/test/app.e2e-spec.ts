import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureAppSecurity } from './../src/security/app-security';

describe('Module Organization - NestJS E2E', () => {
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

  /**
   * Helper: extract all registered GET routes from the Express router.
   */
  function discoverGetRoutes(): string[] {
    const adapter = app.getHttpAdapter();
    const instance = adapter.getInstance();
    // Express lazily creates `._router` on first use; `.router` (getter)
    // returns the same internal Router instance.
    const router = instance.router as { stack: any[] };
    const getRoutes: string[] = [];

    for (const layer of router.stack) {
      if (layer.route && layer.route.methods?.get) {
        getRoutes.push(layer.route.path);
      }
    }

    return getRoutes;
  }

  // ------------------------------------------------------------------
  // Root route
  // ------------------------------------------------------------------
  describe('AppController root route', () => {
    it('/ (GET) should return 200 with Hello World!', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  // ------------------------------------------------------------------
  // Module-organization: verify every registered controller route resolves
  // ------------------------------------------------------------------
  describe('All registered controller routes resolve', () => {
    it('should discover at least one GET route from registered controllers', () => {
      const routes = discoverGetRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    it('the root route should be among registered GET routes', () => {
      const routes = discoverGetRoutes();
      expect(routes).toContain('/');
    });

    it('every registered GET route resolves to a controller (no 500)', async () => {
      const getRoutes = discoverGetRoutes();

      for (const routePath of getRoutes) {
        const response = await request(app.getHttpServer()).get(routePath);
        // A properly resolved route returns:
        //  - 200/201: successful response (no auth required)
        //  - 302: redirect
        //  - 401/403: authentication/authorization required
        //  - 404: valid route but resource not found
        // A 500 would indicate a crash — fail the test.
        expect(response.status).not.toBe(500);
        expect([200, 201, 302, 401, 403, 404]).toContain(response.status);
      }
    });
  });

  // ------------------------------------------------------------------
  // CSRF security middleware (preserved from original tests)
  // ------------------------------------------------------------------
  describe('CSRF security middleware', () => {
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
        .set('Cookie', [
          'access_token=session-cookie; csrf_token=trusted-token',
        ])
        .set('X-CSRF-Token', 'trusted-token')
        .send({ state: 'change' })
        .expect(404);
    });
  });
});
