import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const OPENAPI_DOCS_PATH = 'api/v2/docs';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Gatheraa API v2')
    .setDescription('Runtime generated OpenAPI specification for Gatheraa API v2')
    .setVersion('2.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });
}

export function setupOpenApiDocs(app: INestApplication) {
  SwaggerModule.setup(OPENAPI_DOCS_PATH, app, createOpenApiDocument(app));
}
