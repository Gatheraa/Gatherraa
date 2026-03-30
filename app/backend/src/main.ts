import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { RateLimitGuard } from './rate-limit/guards/rate-limit.guard';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { initSentry } from './monitoring/sentry';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable Global Versioning with Custom Extractor
  app.enableVersioning({
    type: VersioningType.CUSTOM,
    extractor: (request: any) => {
      // 1. URL Versioning (v1, v2...)
      const urlMatch = request.url.match(/^\/v(\d+)\//);
      if (urlMatch) return urlMatch[1];

      // 2. Custom Header
      const headerVersion = request.headers['x-api-version'];
      if (headerVersion) return headerVersion;

      // 3. Media Type (Accept Header)
      const acceptHeader = request.headers['accept'];
      if (acceptHeader) {
        const match = acceptHeader.match(/vnd\.gatherra\.v(\d+)\+json/);
        if (match) return match[1];
      }

      return '1'; // Default version
    },
  });

  // Setup Swagger for multiple versions
  const config = new DocumentBuilder()
    .setTitle('Gatherra API')
    .setDescription('The Gatherra Platform API description')
    .setVersion('1.0')
    .addTag('gatherra')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Setup v1 documentation
  const configV1 = new DocumentBuilder()
    .setTitle('Gatherra API v1')
    .setDescription('v1 of the Gatherra API (Deprecated)')
    .setVersion('1.0')
    .build();
  const documentV1 = SwaggerModule.createDocument(app, configV1, {
    include: [AppModule], // Replace with v1 specific modules/controllers
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v1/docs', app, documentV1);

  // Setup v2 documentation
  const configV2 = new DocumentBuilder()
    .setTitle('Gatherra API v2')
    .setDescription('v2 of the Gatherra API (Latest)')
    .setVersion('2.0')
    .build();
  const documentV2 = SwaggerModule.createDocument(app, configV2, {
    deepScanRoutes: true,
  });
  SwaggerModule.setup('api/v2/docs', app, documentV2);

  // Setup WebSocket with Redis adapter for horizontal scaling
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  app.useWebSocketAdapter(new IoAdapter(app.getHttpServer()));
  app.getHttpServer().of('/notifications').adapter = createAdapter(
    pubClient,
    subClient,
  );

  // Global rate limiting guard
  app.useGlobalGuards(app.get(RateLimitGuard));

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Enable CORS for frontend communication
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://yourdomain.com']
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

initSentry();

bootstrap();
