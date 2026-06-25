#!/usr/bin/env bash

set -euo pipefail

MODE="verify"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --record-trends)
      MODE="record"
      shift
      ;;
    --verify-only)
      MODE="verify"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--verify-only|--record-trends]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACT_DIR="$ROOT_DIR/contract"
REPORTS_DIR="$CONTRACT_DIR/gas_reports"
BASELINES_DIR="$CONTRACT_DIR/gas_baselines"
LOG_FILE="$REPORTS_DIR/gas_benchmark.log"

mkdir -p "$REPORTS_DIR"

echo "[INFO] Running gas benchmark suite via gathera-test..."
pushd "$CONTRACT_DIR" >/dev/null
cargo test --package gathera-test -- --nocapture --test-threads=1 2>&1 | tee "$LOG_FILE"
popd >/dev/null

echo "[INFO] Comparing benchmark output against tracked baselines..."
node "$ROOT_DIR/scripts/gas_regression_check.js" \
  --log-file "$LOG_FILE" \
  --reports-dir "$REPORTS_DIR" \
  --baselines-dir "$BASELINES_DIR" \
  --mode "$MODE"

echo "[INFO] Gas profiling completed. Reports available in $REPORTS_DIR"
