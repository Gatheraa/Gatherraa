// MUST be the first import: registers OpenTelemetry instrumentation hooks
// before NestJS boots (see instrumentation.ts).
import './instrumentation';

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureAppSecurity } from './security/app-security';
import { setupOpenApiDocs } from './openapi';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RateLimitGuard } from './rate-limit/guards/rate-limit.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureAppSecurity(app);

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new LoggingInterceptor(),
  );

  setupOpenApiDocs(app);

  const reflector = app.get(Reflector);
  const rateLimitGuard = app.get(RateLimitGuard);
  app.useGlobalGuards(new JwtAuthGuard(reflector), rateLimitGuard);

  await app.listen(3000);
}

void bootstrap();
