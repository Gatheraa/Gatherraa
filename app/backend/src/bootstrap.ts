import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value) {
    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function configureApp(app: INestApplication): void {
  const allowedOrigins = parseAllowedOrigins(
    process.env.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ORIGINS,
  );

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor(), new LoggingInterceptor());
}
