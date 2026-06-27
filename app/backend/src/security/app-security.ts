import type { INestApplication } from '@nestjs/common';
import { csrfDoubleSubmitMiddleware } from './csrf.middleware';

export function configureAppSecurity(app: INestApplication) {
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Version',
      'X-CSRF-Token',
      'X-XSRF-Token',
    ],
  });

  app.use(csrfDoubleSubmitMiddleware);
}
