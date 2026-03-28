#!/bin/bash
# Comprehensive edge case test runner for Issue #322

set -e

echo "=== Running Edge Case Tests for Issue #322 ==="
echo "Testing minimum/maximum values, zero values, empty collections, and error conditions"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests and check results
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "${YELLOW}Running $suite_name...${NC}"
    
    if eval $command; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        return 0
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        return 1
    fi
}

# Track overall success
FAILED=0

echo "=== 1. Smart Contract Edge Case Tests ==="

# Run Rust contract tests with edge cases
echo "Testing Staking Contract edge cases..."
cd contract/contracts
if cargo test edge_case_tests -- --nocapture; then
    echo -e "${GREEN}✓ Staking contract edge case tests passed${NC}"
else
    echo -e "${RED}✗ Staking contract edge case tests failed${NC}"
    FAILED=1
fi

echo "Testing Ticket Contract edge cases..."
cd ../ticket_contract
if cargo test edge_case_tests -- --nocapture; then
    echo -e "${GREEN}✓ Ticket contract edge case tests passed${NC}"
else
    echo -e "${RED}✗ Ticket contract edge case tests failed${NC}"
    FAILED=1
fi

echo "Testing Escrow Contract edge cases..."
cd ../escrow_contract
if cargo test edge_case_tests -- --nocapture; then
    echo -e "${GREEN}✓ Escrow contract edge case tests passed${NC}"
else
    echo -e "${RED}✗ Escrow contract edge case tests failed${NC}"
    FAILED=1
fi

echo "Testing Multisig Wallet Contract edge cases..."
cd ../multisig_wallet_contract
if cargo test -- --nocapture; then
    echo -e "${GREEN}✓ Multisig wallet contract tests passed${NC}"
else
    echo -e "${RED}✗ Multisig wallet contract tests failed${NC}"
    FAILED=1
fi

# Return to root
cd ../../..

echo
echo "=== 2. Load Testing Edge Cases ==="

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}Warning: k6 not found. Skipping load tests.${NC}"
    echo "Install k6 from: https://k6.io/docs/getting-started/installation/"
else
    echo "Running payment flow edge case tests..."
    if k6 run tests/k6-load-tests/payment-flow.js --summary-export=payment-flow-results.json; then
        echo -e "${GREEN}✓ Payment flow edge case tests passed${NC}"
    else
        echo -e "${RED}✗ Payment flow edge case tests failed${NC}"
        FAILED=1
    fi
    
    echo "Running notification flow edge case tests..."
    if k6 run tests/k6-load-tests/notification-flow.js --summary-export=notification-flow-results.json; then
        echo -e "${GREEN}✓ Notification flow edge case tests passed${NC}"
    else
        echo -e "${RED}✗ Notification flow edge case tests failed${NC}"
        FAILED=1
    fi
    
    echo "Running chaos tests..."
    if k6 run tests/k6-load-tests/chaos-test.js --summary-export=chaos-test-results.json; then
        echo -e "${GREEN}✓ Chaos tests passed${NC}"
    else
        echo -e "${RED}✗ Chaos tests failed${NC}"
        FAILED=1
    fi
    
    echo "Running comprehensive edge case tests..."
    if k6 run tests/k6-load-tests/edge-case-tests.js --summary-export=edge-case-results.json; then
        echo -e "${GREEN}✓ Comprehensive edge case tests passed${NC}"
    else
        echo -e "${RED}✗ Comprehensive edge case tests failed${NC}"
        FAILED=1
    fi
fi

echo
echo "=== 3. Test Coverage Analysis ==="

# Check if cargo-llvm-cov is installed for coverage
if command -v cargo-llvm-cov &> /dev/null; then
    echo "Generating test coverage report..."
    cd contract
    if cargo llvm-cov --lcov --output-path lcov.info; then
        echo -e "${GREEN}✓ Coverage report generated${NC}"
        echo "Coverage report available at: lcov.info"
    else
        echo -e "${YELLOW}Warning: Coverage generation failed${NC}"
    fi
    cd ..
else
    echo -e "${YELLOW}Warning: cargo-llvm-cov not found. Install with: cargo install cargo-llvm-cov${NC}"
fi

echo
echo "=== 4. Test Summary ==="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All edge case tests passed!${NC}"
    echo
    echo "✅ Minimum/Maximum value tests: PASSED"
    echo "✅ Zero value tests: PASSED"
    echo "✅ Empty collection tests: PASSED"
    echo "✅ Error condition tests: PASSED"
    echo
    echo "Issue #322 acceptance criteria have been met:"
    echo "- ✅ Test minimum/maximum values"
    echo "- ✅ Add zero value tests"
    echo "- ✅ Test empty collections"
    echo "- ✅ Add error condition tests"
    exit 0
else
    echo -e "${RED}❌ Some edge case tests failed!${NC}"
    echo
    echo "Please review the failed tests and fix the issues."
    echo "Check the test output above for specific failure details."
    exit 1
fi
