#!/bin/bash
# Helper script to run k6 tests with InfluxDB output

if [ -z "$1" ]; then
  echo "Usage: ./run-test.sh <scenario_file>"
  echo "Example: ./run-test.sh scenarios/payment-flow.js"
  exit 1
fi

SCENARIO=$1

echo "Running k6 test for scenario: $SCENARIO"
k6 run --out influxdb=http://localhost:8086/k6 $SCENARIO