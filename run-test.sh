#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./run-test.sh <scenario_file>"
    echo "Example: ./run-test.sh scenarios/payment-flow.js"
    exit 1
fi

SCENARIO=$1

echo "Running load test: $SCENARIO"
echo "Metrics will be pushed to InfluxDB..."

k6 run --out influxdb=http://localhost:8086/k6 "$SCENARIO"