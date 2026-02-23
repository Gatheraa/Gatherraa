# Kong API Gateway (local dev)

This folder provides a development setup for a Kong API Gateway backed by PostgreSQL and a mounted OpenAPI file.

Quick start (from repository root):

1. Start Kong + Postgres + Swagger UI:

```bash
docker-compose -f app/backend/kong/docker-compose.kong.yml up --build
```

2. Notes:
- The example `kong.yml` routes the `/api/v1` prefix to `http://host.docker.internal:3000`.
- On Linux you may need to replace `host.docker.internal` with your host IP or run Kong in the same Docker network as your backend service. Alternatively run your backend in Docker and point `backend.url` at that container.
- A demo API key is included in the declarative config: `demo-key-123` for the `internal-client` consumer. Use header `apikey: demo-key-123` when calling proxied endpoints.

3. Swagger UI (docs):
- Available at http://localhost:8080 and loads the aggregated OpenAPI at `docs/openapi/gateway-swagger.yaml`.

4. What is included:
- `kong.yml` — declarative configuration (services, routes, plugins, consumer credential)
- `docker-compose.kong.yml` — postgres + kong + migrations bootstrap + swagger-ui
- `docs/openapi/gateway-swagger.yaml` — minimal aggregated OpenAPI spec for the gateway

5. Next steps to integrate with this repo:
- Replace `backend.url` in `kong.yml` with the actual internal service addresses used by your backend containers.
- Harden auth (rotate keys, use JWT with an OIDC provider, or integrate Kong with Keycloak/AWS Cognito).
- Tune cache plugin or add Redis-backed cache for production.
- Add more routes in `kong.yml` for other microservices and API versions (e.g., `/api/v2`).
