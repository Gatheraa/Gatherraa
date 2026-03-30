#!/bin/bash

# Performance Tests Runner
# Executes all performance tests with appropriate configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORTS_DIR="reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Gatherraa Performance Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local env_vars=${3:-""}
    
    echo -e "${YELLOW}[INFO]${NC} Running $test_name..."
    echo -e "${BLUE}----------------------------------------${NC}"
    
    START_TIME=$(date +%s)
    
    if [ -n "$env_vars" ]; then
        eval "$env_vars k6 run --summary-export=$REPORTS_DIR/${test_file%.js}_$TIMESTAMP.json $test_file"
    else
        k6 run --summary-export=$REPORTS_DIR/${test_file%.js}_$TIMESTAMP.json $test_file
    fi
    
    EXIT_CODE=$?
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}[SUCCESS]${NC} $test_name completed in ${DURATION}s"
    else
        echo -e "${RED}[FAILED]${NC} $test_name failed with exit code $EXIT_CODE"
        return 1
    fi
    
    echo ""
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} k6 is not installed. Please install k6 first."
    echo "Install from: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo -e "${BLUE}k6 version:$(k6 version)${NC}"
echo ""

# Run tests based on mode
MODE=${1:-full}

case $MODE in
    "quick")
        echo -e "${YELLOW}Running quick performance checks...${NC}"
        echo ""
        
        run_test "API Benchmark" "api-benchmark.js"
        run_test "Regression Test" "regression-test.js" "BASELINE_P95=500 BASELINE_P99=1000"
        ;;
    
    "full")
        echo -e "${YELLOW}Running full performance test suite...${NC}"
        echo ""
        
        run_test "API Benchmark" "api-benchmark.js"
        run_test "Payment Stress" "payment-stress.js"
        run_test "Memory Profile" "memory-profile.js"
        run_test "High Load Test" "high-load-test.js"
        run_test "Regression Test" "regression-test.js" "BASELINE_P95=500 BASELINE_P99=1000"
        run_test "Edge Case Tests" "edge-case-tests.js"
        ;;
    
    "ci")
        echo -e "${YELLOW}Running CI/CD performance checks...${NC}"
        echo ""
        
        # Quick regression check for CI
        run_test "CI Regression" "regression-test.js" "BASELINE_P95=500 BASELINE_P99=1000"
        
        # API benchmark
        run_test "API Benchmark" "api-benchmark.js"
        ;;
    
    "spike")
        echo -e "${YELLOW}Running spike and high load tests...${NC}"
        echo ""
        
        run_test "High Load Test" "high-load-test.js"
        run_test "Chaos Test" "chaos-test.js"
        ;;
    
    "memory")
        echo -e "${YELLOW}Running memory profiling tests...${NC}"
        echo ""
        
        run_test "Memory Profile" "memory-profile.js"
        ;;
    
    *)
        echo -e "${RED}[ERROR]${NC} Unknown mode: $MODE"
        echo "Usage: $0 [quick|full|ci|spike|memory]"
        echo ""
        echo "Modes:"
        echo "  quick  - Quick performance checks (2 tests, ~15 min)"
        echo "  full   - Full test suite (6 tests, ~40 min)"
        echo "  ci     - CI/CD pipeline checks (2 tests, ~15 min)"
        echo "  spike  - High load and spike tests (2 tests, ~12 min)"
        echo "  memory - Memory profiling (1 test, ~12 min)"
        exit 1
        ;;
esac

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All tests completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Reports saved to:${NC} $REPORTS_DIR/"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review summaries: cat $REPORTS_DIR/*_$TIMESTAMP.json | jq"
echo "2. Generate HTML report: k6 run --out html=report.html api-benchmark.js"
echo "3. Upload to Grafana: k6 run --out influxdb=http://localhost:8086/k6 api-benchmark.js"
echo ""
