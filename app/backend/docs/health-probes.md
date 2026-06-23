# Health And Readiness Probes

The backend exposes two probe endpoints:

- `GET /healthz`: liveness probe. It returns `200` as long as the NestJS process can answer HTTP requests.
- `GET /readyz`: readiness probe. It returns `200` only when required dependencies are reachable; otherwise it returns `503`.

## Dependency Checks

Readiness checks use TCP reachability and never expose credentials in the response.

Supported configuration:

- Database: `DATABASE_URL`, or `DB_HOST` / `DB_PORT`, or `DATABASE_HOST` / `DATABASE_PORT`.
- Redis: `REDIS_URL`, or `REDIS_HOST` / `REDIS_PORT`.
- Queue Redis: `QUEUE_REDIS_URL`, or `QUEUE_REDIS_HOST` / `QUEUE_REDIS_PORT`, or `BULL_REDIS_URL`. If none are set, the queue check reuses the Redis target.
- Timeout: `HEALTH_READINESS_TIMEOUT_MS`, default `1000`.
- Explicit required checks: `HEALTH_READINESS_CHECKS=database,redis,queue`.

In production, database, Redis, and queue checks are required by default. Outside production, unconfigured dependencies are reported as `skipped` so local development and tests can boot without external services.

## Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  periodSeconds: 10
  timeoutSeconds: 2
readinessProbe:
  httpGet:
    path: /readyz
    port: 3000
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
```

## Cloud Run

Use `/healthz` as the startup probe and `/readyz` for any external readiness gate or deployment verification step.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 12
```
