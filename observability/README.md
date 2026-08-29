# Observability Stack

This folder contains a local development observability stack: Prometheus, Grafana, Loki (logs), Promtail (log shipping), and Jaeger (tracing). The compose file is fully functional — start it and every service comes up with its config.

Quick start (from repository root):

```bash
docker-compose -f observability/docker-compose.observability.yml up --build
```

Access:

- Grafana: http://localhost:3000 (user: admin, password: admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Jaeger UI: http://localhost:16686

Prometheus configuration:

- `observability/prometheus/prometheus.yml` — scrape targets. Adjust IPs/hostnames for services running on host or in Docker.
- `observability/prometheus/alert.rules.yml` — example alert rules.

Logging:

- `observability/loki/local-config.yaml` — Loki config (mounted into the container).
- `observability/promtail/config.yml` — reads `/var/log` and Docker container logs; adapt paths for your environment.

---

## Tracing (OpenTelemetry) — implemented in this repository

The backend (`app/backend`) is instrumented with OpenTelemetry. Unlike the old
"install these packages yourself" instructions this README used to carry, the
dependencies are declared in `app/backend/package.json` and the SDK is wired
into the app:

- **Dependencies** — `@opentelemetry/api`, `@opentelemetry/sdk-node`,
  `@opentelemetry/exporter-trace-otlp-http`,
  `@opentelemetry/auto-instrumentations-node` (includes HTTP/Express
  instrumentation, so every request handled by the backend produces a span).
- **Bootstrap** — `app/backend/src/instrumentation.ts` builds and starts the
  `NodeSDK`. `app/backend/src/main.ts` imports it **first**, before NestJS,
  which is the required order for auto-instrumentation hooks.
- **Exporter** — OTLP/HTTP, compatible with the Jaeger receiver in
  `observability/docker-compose.observability.yml` (port `4318`) and with
  `ops/docker-configs/docker-compose.monitoring.yml` (set
  `OTEL_EXPORTER_OTLP_ENDPOINT` accordingly).
- **Safety** — importing `instrumentation.ts` is a no-op when tracing is
  disabled, so tests (`NODE_ENV=test`) and unconfigured production runs are
  unaffected.

### Configuration (all environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` (dev) | OTLP/HTTP base endpoint; `/v1/traces` is appended. In `production` this must be set explicitly — tracing stays off otherwise. |
| `OTEL_SERVICE_NAME` | `gatherraa-backend` | Service name shown in traces. |
| `OTEL_SDK_DISABLED` | unset | Set to `true`/`1` to disable tracing entirely. |

Tracing is enabled by default in development and disabled in `test`. Export
failures are logged but never crash the process.

### Verification — one backend span in Jaeger

Automated (starts Jaeger if needed, emits one span, confirms Jaeger received it):

```bash
./observability/verify-tracing.sh
```

Expected output ends with:

```
[verify-tracing] OK — one backend span exported and received by Jaeger:
  service : gatherraa-backend
  span    : <span-id> (verify.backend-span)
  trace   : <trace-id>
  Jaeger UI: http://localhost:16686/trace/<trace-id>
```

Manual (while the backend is running):

```bash
docker-compose -f observability/docker-compose.observability.yml up -d jaeger
cd app/backend && npm install && npm run start:dev
curl http://localhost:3000/healthz
```

Then open http://localhost:16686, pick `gatherraa-backend` as the service, and
the `GET /healthz` request appears as a span.

---

## Implemented in this repository (non-tracing)

- **Backend health probes** — `app/backend/src/health/` exposes
  `GET /healthz` (liveness) and `GET /readyz` (readiness incl. DB check).
  `observability/docker-compose.monitoring.yml` uses `/healthz` for its
  container healthcheck.
- **Sentry initialization** — `app/backend/src/monitoring/sentry.ts`
  (`SENTRY_DSN`), wired in the frontend.

## Examples & reference (NOT wired into this repository)

The following are illustrative guidance only — nothing in the repo depends on
them, and adopting them is opt-in work:

- **Alertmanager & alert routing** — alert rules ship in
  `observability/prometheus/alert.rules.yml`, but there is no Alertmanager
  service and no notification channel integration. Add Alertmanager to route
  alerts to email/Slack if needed.
- **SLOs** — track SLOs using Prometheus recording rules and Grafana SLO
  panels; no SLO rules ship yet.
- **`@nestjs/terminus`** — the NestJS docs
  (https://docs.nestjs.com/recipes/terminus) are a reference for readiness
  probes. This repository ships its own health module instead
  (`app/backend/src/health/`).
- **Generic OpenTelemetry snippets** — the OpenTelemetry SDK docs are the
  reference for span taxonomy and custom instrumentation
  (https://opentelemetry.io/docs/languages/js/).

## Next steps

- Add Alertmanager and integrate notification channels.
- Add more detailed Grafana dashboards and panels for service-specific metrics.
- Instrument the image service (`app/image-service`) with the same
  OpenTelemetry bootstrap used by the backend.
