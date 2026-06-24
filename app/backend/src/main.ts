import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureAppSecurity } from './security/app-security';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// import { ValidationPipe, VersioningType } from '@nestjs/common';
// import { NestExpressApplication } from '@nestjs/platform-express';
// import { join } from 'path';
// import { RateLimitGuard } from './rate-limit/guards/rate-limit.guard';
// import { IoAdapter } from '@nestjs/platform-socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'redis';
// import { initSentry } from './monitoring/sentry';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureAppSecurity(app);
  app.useGlobalInterceptors(new LoggingInterceptor());

  // app.enableVersioning({...});

  // const config = new DocumentBuilder()
  //   .setTitle('Gatherra API')
  //   .setDescription('The Gatherra Platform API description')
  //   .setVersion('1.0')
  //   .addTag('gatherra')
  //   .build();

  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api/docs', app, document);

  // const configV1 = new DocumentBuilder()
  //   .setTitle('Gatherra API v1')
  //   .setDescription('v1 of the Gatherra API (Deprecated)')
  //   .setVersion('1.0')
  //   .build();

  // const documentV1 = SwaggerModule.createDocument(app, configV1, {
  //   include: [AppModule],
  //   deepScanRoutes: true,
  // });

  // SwaggerModule.setup('api/v1/docs', app, documentV1);

  // const configV2 = new DocumentBuilder()
  //   .setTitle('Gatherra API v2')
  //   .setDescription('v2 of the Gatherra API (Latest)')
  //   .setVersion('2.0')
  //   .build();

  // const documentV2 = SwaggerModule.createDocument(app, configV2, {
  //   deepScanRoutes: true,
  // });

  // SwaggerModule.setup('api/v2/docs', app, documentV2);

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

  await app.listen(3000);
}

// initSentry();

void bootstrap();
