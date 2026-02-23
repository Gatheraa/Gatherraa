# Observability Stack

This folder contains a local development observability stack: Prometheus, Grafana, Loki (logs), Promtail (log shipping), and Jaeger (tracing).

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
- `observability/loki` contains Loki config (mounted into container).
- `observability/promtail/config.yml` is configured to read `/var/log` and Docker container logs; adapt paths for your environment.

Tracing & Instrumentation (NestJS/OpenTelemetry):

Install OpenTelemetry packages in the service you want to trace:

```bash
npm install --save @opentelemetry/sdk-node @opentelemetry/api @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express @opentelemetry/instrumentation-grpc @opentelemetry/instrumentation-http
```

Minimal Node bootstrap example (place near your app entry):

```js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const sdk = new NodeSDK({
  traceExporter: new JaegerExporter({ endpoint: 'http://localhost:14268/api/traces' }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Health checks (NestJS):
- Use `@nestjs/terminus` to add readiness/liveness endpoints. See `https://docs.nestjs.com/recipes/terminus`.

Alerts & SLOs:
- Alert rules live in `observability/prometheus/alert.rules.yml`. Add Alertmanager to route alerts to email/Slack if needed.
- Track SLOs using Prometheus recording rules and Grafana SLO panel.

Next steps:
- Add Alertmanager and integrate notification channels.
- Add more detailed Grafana dashboards and panels for service-specific metrics.
- Instrument all backend services with OpenTelemetry and ensure traces include service names and spans.
