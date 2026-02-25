# Gatheraa Load Testing Framework

This directory contains the comprehensive load testing framework for Gatheraa, built with [k6](https://k6.io/). It is designed to simulate realistic user traffic, detect performance regressions, and help identify bottlenecks in the Payment and Notification services.

## Architecture

- **k6**: The load testing engine that executes the test scripts.
- **InfluxDB**: Time-series database to store real-time test metrics.
- **Grafana**: Visualization dashboard to monitor performance baselines and regressions.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [k6](https://k6.io/docs/getting-started/installation/) (optional if running via Docker)

## Setup Infrastructure

Start the metrics backend (InfluxDB and Grafana):

```bash
cd test/load
docker-compose up -d
```

Grafana will be available at `http://localhost:3000` (Default creds: `admin`/`admin`).

## Running Tests

You can run tests using the provided helper script:

```bash
chmod +x run-test.sh
./run-test.sh scenarios/payment-flow.js
```

Or manually with k6:

```bash
k6 run --out influxdb=http://localhost:8086/k6 scenarios/payment-flow.js
```

## Scenarios

- **Payment Flow** (`scenarios/payment-flow.js`): Simulates high-volume ticket purchases via Stripe and Crypto.
- **Notification Flow** (`scenarios/notification-flow.js`): Tests WebSocket connection stability and message delivery latency.

## Thresholds & Baselines

Tests are configured with pass/fail thresholds (e.g., 95% of requests < 500ms). If these thresholds are breached, the CI/CD pipeline will fail, signaling a performance regression.