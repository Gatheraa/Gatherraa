# Load Testing & Performance Tests

This directory contains comprehensive load testing and performance benchmarking scripts using k6 (https://k6.io/).

## Overview

Our performance testing suite includes:

- **API Benchmarks** - Standard performance baselines for all endpoints
- **Payment Stress Tests** - High-volume payment processing under various loads
- **Memory Profiling** - Detect memory leaks and optimize heap usage
- **Regression Tests** - Automated performance regression detection
- **High Load Tests** - Spike and breakpoint testing to find system limits
- **Edge Case Tests** - Boundary conditions and error scenarios

## Setup

### Install k6

```bash
# macOS
brew install k6

# Linux (Ubuntu/Debian)
sudo apt-get install k6

# Windows (via Chocolatey)
choco install k6

# Docker
docker run -i grafana/k6
```

### Start Monitoring Stack (Optional)

For real-time metrics visualization:

```bash
# Start InfluxDB and Grafana
docker-compose up -d

# Access Grafana at http://localhost:3000
# Default credentials: admin / admin
```

## Test Scenarios

### Performance Benchmarks

**api-benchmark.js** - Comprehensive API performance testing
```bash
k6 run api-benchmark.js
# Tests: Light, Standard, and Heavy load scenarios
# Duration: ~8 minutes
# VUs: 5-100 concurrent users
```

**payment-stress.js** - Payment processing under stress
```bash
k6 run payment-stress.js
# Tests: Normal load, Spike test, Breakpoint test
# Duration: ~7 minutes
# Rate: 10-500 requests/second
```

**memory-profile.js** - Memory leak detection and profiling
```bash
k6 run memory-profile.js
# Tests: Soak test, Memory spike
# Duration: ~12 minutes
# Monitors: RSS, Heap size, GC pauses, Cache hits
```

### Regression Testing

**regression-test.js** - Performance regression detection
```bash
# Quick check (CI/CD)
k6 run regression-test.js

# With custom baselines
BASELINE_P95=500 BASELINE_P99=1000 k6 run regression-test.js
# Duration: ~10 minutes
# Compares against baseline thresholds
```

### High Load Testing

**high-load-test.js** - Extreme load scenarios
```bash
k6 run high-load-test.js
# Tests: Spike (10x traffic), Breakpoint (find limits)
# Duration: ~8 minutes
# Max VUs: 500-1000 concurrent users
```

### Real-time & WebSockets

**notification-flow.js** - WebSocket scaling
```bash
k6 run notification-flow.js
# Tests: 50 concurrent WebSocket connections
# Duration: ~2 minutes
# Monitors: Connection time, Message latency
```

### Chaos & Edge Cases

**chaos-test.js** - Traffic spike recovery
```bash
k6 run chaos-test.js
# Tests: System resilience under sudden load
# Duration: ~3 minutes
```

**edge-case-tests.js** - Boundary conditions
```bash
k6 run edge-case-tests.js
# Tests: Min/max values, Zero amounts, Invalid auth, Timeouts
# Duration: ~5 minutes
```

## Running Tests

### Basic Execution

```bash
# Run a single test
k6 run api-benchmark.js

# Run with custom environment variables
BASELINE_P95=500 BASELINE_P99=1000 k6 run regression-test.js

# Run with JSON output
k6 run --out json=results.json api-benchmark.js

# Run with summary export
k6 run --summary-export=summary.json payment-stress.js
```

### Docker Execution

```bash
# Run tests in Docker
docker run -v $(pwd):/scripts grafana/k6 run /scripts/api-benchmark.js

# With InfluxDB output
docker run -v $(pwd):/scripts \
  --network host \
  grafana/k6 run \
  --out influxdb=http://localhost:8086/k6 \
  /scripts/payment-stress.js
```

### Automated Test Suite

Run all performance tests sequentially:

```bash
chmod +x run-performance-tests.sh
./run-performance-tests.sh
```

## Configuration

Edit the `options` section in each script to modify:
- Duration (stages)
- Target load (concurrent users/requests)
- Thresholds (performance requirements)
