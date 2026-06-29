import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureAppSecurity } from './security/app-security';
import { setupOpenApiDocs } from './openapi';

// import { ValidationPipe, VersioningType } from '@nestjs/common';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import { join } from 'path';
// import { RateLimitGuard } from './rate-limit/guards/rate-limit.guard';
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'redis';
// import { initSentry } from './monitoring/sentry';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureAppSecurity(app);

  // Configure CORS with env-driven allowed origins
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // app.enableVersioning({...});

  setupOpenApiDocs(app);

  // const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  // const pubClient = createClient({ url: redisUrl });
  // const subClient = pubClient.duplicate();

  // await Promise.all([pubClient.connect(), subClient.connect()]);

  // app.useWebSocketAdapter(new IoAdapter(app.getHttpServer()));

  // app.getHttpServer().of('/notifications').adapter = createAdapter(
  //   pubClient,
  //   subClient,
  // );

  // app.useGlobalGuards(app.get(RateLimitGuard));

  // app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  //   prefix: '/uploads/',
  // });

  // app.useGlobalPipes(
  //   new ValidationPipe({
  //     whitelist: true,
  //     forbidNonWhitelisted: true,
  //     transform: true,
  //   }),
  // );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  await app.listen(3000);
}

// initSentry();

void bootstrap();
