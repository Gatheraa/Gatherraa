#!/usr/bin/env bash
#
# Local verification path for backend OpenTelemetry tracing (issue #695).
#
# 1. Ensures the Jaeger collector/UI from the observability stack is running
#    (starts it via docker compose if not).
# 2. Runs `npm run tracing:verify` in app/backend, which emits exactly one
#    span through the repository's real tracing bootstrap and confirms Jaeger
#    received it.
#
# Usage:
#   ./observability/verify-tracing.sh
#
# Environment overrides:
#   JAEGER_QUERY_URL  Jaeger query base URL (default http://localhost:16686)
#   OTEL_SERVICE_NAME Service name to look for (default gatherraa-backend)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAEGER_QUERY_URL="${JAEGER_QUERY_URL:-http://localhost:16686}"
COMPOSE_FILE="${ROOT}/observability/docker-compose.observability.yml"

echo "==> Checking Jaeger at ${JAEGER_QUERY_URL} …"
if ! curl -sf "${JAEGER_QUERY_URL}/api/services" >/dev/null 2>&1; then
  echo "==> Jaeger not reachable — starting it via docker compose …"
  docker compose -f "${COMPOSE_FILE}" up -d jaeger
fi

echo "==> Waiting for Jaeger query API …"
for _ in $(seq 1 60); do
  if curl -sf "${JAEGER_QUERY_URL}/api/services" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -sf "${JAEGER_QUERY_URL}/api/services" >/dev/null 2>&1; then
  echo "ERROR: Jaeger did not become ready at ${JAEGER_QUERY_URL}" >&2
  exit 1
fi

echo "==> Emitting one backend span and verifying Jaeger receives it …"
(
  cd "${ROOT}/app/backend"
  NODE_ENV="${NODE_ENV:-development}" \
    OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}" \
    JAEGER_QUERY_URL="${JAEGER_QUERY_URL}" \
    npm run tracing:verify
)

echo "==> Done. Open the Jaeger UI at ${JAEGER_QUERY_URL} to inspect the trace."
