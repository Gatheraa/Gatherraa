/**
 * OpenTelemetry tracing bootstrap for the Gatherraa backend.
 *
 * IMPORTANT — bootstrap order: this module must be imported before any other
 * module (including NestJS) so that auto-instrumentation hooks are registered
 * before the HTTP server starts. `main.ts` therefore imports it first:
 *
 *   import './instrumentation';
 *
 * Importing this module is always safe: when tracing is disabled it is a
 * no-op. Configuration is read from environment variables (see
 * `.env.example`):
 *
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP/HTTP base endpoint (default
 *     `http://localhost:4318`, the Jaeger OTLP receiver used by
 *     `observability/docker-compose.observability.yml`).
 *   - `OTEL_SERVICE_NAME`            — service name shown in traces (default
 *     `gatherraa-backend`).
 *   - `OTEL_SDK_DISABLED`            — set to `true`/`1` to disable tracing.
 *   - `NODE_ENV=test`                — tracing is never started in tests.
 *   - In `production`, tracing only starts when an explicit
 *     `OTEL_EXPORTER_OTLP_ENDPOINT` is configured (never defaults to
 *     localhost in production).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';
const TRACES_PATH = '/v1/traces';

let sdk: NodeSDK | null = null;
let started = false;

function tracingEnabled(): boolean {
  if (process.env.OTEL_SDK_DISABLED === 'true' || process.env.OTEL_SDK_DISABLED === '1') {
    return false;
  }
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  // Never default to a localhost exporter in production.
  if (process.env.NODE_ENV === 'production' && !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return false;
  }
  return true;
}

function resolveTraceEndpoint(): string {
  const base = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_OTLP_ENDPOINT).replace(
    /\/+$/,
    '',
  );
  return base.endsWith(TRACES_PATH) ? base : `${base}${TRACES_PATH}`;
}

/**
 * Starts the OpenTelemetry SDK (once). Safe to call repeatedly — subsequent
 * calls return the already-started SDK or null.
 */
export function initTracing(): NodeSDK | null {
  if (started) {
    return sdk;
  }
  started = true;

  if (!tracingEnabled()) {
    return null;
  }

  // Surface export/registration errors without spamming every span.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  // Traces-only setup: keep the SDK from also creating metrics/log readers
  // that would export to the same endpoint (Jaeger only accepts traces and
  // the extra 404 noise is confusing). Ops can re-enable via env vars.
  process.env.OTEL_METRICS_EXPORTER = process.env.OTEL_METRICS_EXPORTER ?? 'none';
  process.env.OTEL_LOGS_EXPORTER = process.env.OTEL_LOGS_EXPORTER ?? 'none';

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'gatherraa-backend';
  const traceEndpoint = resolveTraceEndpoint();

  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: traceEndpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  console.log(
    `[tracing] OpenTelemetry enabled — service="${serviceName}" endpoint="${traceEndpoint}"`,
  );

  return sdk;
}

/** Flushes and shuts down the SDK (used by verification scripts). */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

initTracing();
