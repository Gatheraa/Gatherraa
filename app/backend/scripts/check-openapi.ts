import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { stringify } from 'yaml';
import { createOpenApiDocument } from '../src/openapi';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { VersioningMiddleware } from '../src/common/middleware/versioning.middleware';
import { IdentityVerificationController } from '../src/identity-verification/identity-verification.controller';
import { IdentityVerificationService } from '../src/identity-verification/identity-verification.service';

const OPENAPI_FILE = resolve(__dirname, '../../../docs/openapi/gateway-swagger.yaml');

function normalize(content: string) {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

// Stub out the service so no real DB calls are made
const IdentityVerificationServiceMock = {
  provide: IdentityVerificationService,
  useValue: {},
};

// A minimal AppModule that loads controllers but no database
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController, IdentityVerificationController],
  providers: [AppService, IdentityVerificationServiceMock],
})
class OpenApiAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VersioningMiddleware).forRoutes('*');
  }
}

async function generateOpenApiYaml() {
  const app = await NestFactory.create(OpenApiAppModule, { logger: false });

  try {
    await app.init();
    return normalize(
      stringify(createOpenApiDocument(app), {
        lineWidth: 0,
        singleQuote: true,
      }),
    );
  } finally {
    await app.close();
  }
}

async function main() {
  const generated = await generateOpenApiYaml();

  if (process.argv.includes('--write')) {
    writeFileSync(OPENAPI_FILE, generated);
    return;
  }

  const committed = normalize(readFileSync(OPENAPI_FILE, 'utf8'));

  if (committed !== generated) {
    console.error(
      `OpenAPI schema drift detected. Run "npm run openapi:generate" from app/backend and commit ${OPENAPI_FILE}.`,
    );
    process.exitCode = 1;
  }
}

void main();
