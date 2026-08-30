/**
 * Local verification for the backend OpenTelemetry wiring (issue #695).
 *
 * Imports the same tracing bootstrap used by `src/main.ts`, emits exactly one
 * span, flushes it, then polls the Jaeger query API until the span shows up.
 *
 * Usage (from app/backend):
 *   npm run tracing:verify
 *
 * Requires Jaeger to be reachable at $JAEGER_QUERY_URL (default
 * http://localhost:16686). Start it with:
 *   docker compose -f observability/docker-compose.observability.yml up -d jaeger
 * or run observability/verify-tracing.sh which orchestrates both steps.
 */
import '../src/instrumentation';
import { trace } from '@opentelemetry/api';
import { initTracing, shutdownTracing } from '../src/instrumentation';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'gatherraa-backend';
const SPAN_NAME = 'verify.backend-span';
const JAEGER_QUERY_URL = process.env.JAEGER_QUERY_URL ?? 'http://localhost:16686';
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findVerifyTrace(): Promise<{ traceID: string; spanID: string } | null> {
  const url = `${JAEGER_QUERY_URL}/api/traces?service=${encodeURIComponent(SERVICE_NAME)}&limit=20&lookback=10m`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as {
    data?: Array<{ traceID: string; spans: Array<{ spanID: string; operationName: string }> }>;
  };
  for (const trace of body.data ?? []) {
    const span = trace.spans.find((s) => s.operationName === SPAN_NAME);
    if (span) {
      return { traceID: trace.traceID, spanID: span.spanID };
    }
  }
  return null;
}

async function main(): Promise<void> {
  const sdk = initTracing();
  if (!sdk) {
    console.error(
      `[verify-tracing] tracing is disabled (NODE_ENV=${process.env.NODE_ENV}, ` +
        'OTEL_SDK_DISABLED set?). Export OTEL_EXPORTER_OTLP_ENDPOINT or run with NODE_ENV=development.',
    );
    process.exit(1);
  }

  const tracer = trace.getTracer('verify-tracing');
  const span = tracer.startSpan(SPAN_NAME);
  span.setAttribute('verification', 'issue-695');
  span.end();

  // Flush spans out to Jaeger before polling for them.
  await shutdownTracing();

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let found: { traceID: string; spanID: string } | null = null;
  while (Date.now() < deadline) {
    found = await findVerifyTrace();
    if (found) {
      break;
    }
    await delay(POLL_INTERVAL_MS);
  }

  if (!found) {
    console.error(
      `[verify-tracing] span "${SPAN_NAME}" for service "${SERVICE_NAME}" was not found at ` +
        `${JAEGER_QUERY_URL} within ${POLL_TIMEOUT_MS / 1000}s. Is Jaeger running?`,
    );
    process.exit(1);
  }

  console.log('[verify-tracing] OK — one backend span exported and received by Jaeger:');
  console.log(`  service : ${SERVICE_NAME}`);
  console.log(`  span    : ${found.spanID} (${SPAN_NAME})`);
  console.log(`  trace   : ${found.traceID}`);
  console.log(`  Jaeger UI: ${JAEGER_QUERY_URL}/trace/${found.traceID}`);
}

void main();
