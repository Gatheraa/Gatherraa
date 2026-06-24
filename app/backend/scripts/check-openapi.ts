import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';
import { createOpenApiDocument } from '../src/openapi';

const OPENAPI_FILE = resolve(__dirname, '../../../docs/openapi/gateway-swagger.yaml');

function normalize(content: string) {
  return content.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

async function generateOpenApiYaml() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

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
