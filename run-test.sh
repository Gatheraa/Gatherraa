#!/bin/bash
# Comprehensive test script for Gathera contracts with gas usage reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "contract" ]; then
    print_error "Contract directory not found. Please run from project root."
    exit 1
fi

# Parse command line arguments
RUN_STANDARD_TESTS=true
RUN_GAS_TESTS=true
RUN_BENCHMARKS=true
RUN_LIMIT_TESTS=true
RUN_REGRESSION_TESTS=true
GENERATE_REPORTS=true
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --standard-only)
            RUN_STANDARD_TESTS=true
            RUN_GAS_TESTS=false
            RUN_BENCHMARKS=false
            RUN_LIMIT_TESTS=false
            RUN_REGRESSION_TESTS=false
            TEST_TYPE="standard"
            shift
            ;;
        --gas-only)
            RUN_STANDARD_TESTS=false
            RUN_GAS_TESTS=true
            RUN_BENCHMARKS=false
            RUN_LIMIT_TESTS=false
            RUN_REGRESSION_TESTS=false
            TEST_TYPE="gas"
            shift
            ;;
        --benchmark-only)
            RUN_STANDARD_TESTS=false
            RUN_GAS_TESTS=false
            RUN_BENCHMARKS=true
            RUN_LIMIT_TESTS=false
            RUN_REGRESSION_TESTS=false
            TEST_TYPE="benchmark"
            shift
            ;;
        --limit-only)
            RUN_STANDARD_TESTS=false
            RUN_GAS_TESTS=false
            RUN_BENCHMARKS=false
            RUN_LIMIT_TESTS=true
            RUN_REGRESSION_TESTS=false
            TEST_TYPE="limit"
            shift
            ;;
        --regression-only)
            RUN_STANDARD_TESTS=false
            RUN_GAS_TESTS=false
            RUN_BENCHMARKS=false
            RUN_LIMIT_TESTS=false
            RUN_REGRESSION_TESTS=true
            TEST_TYPE="regression"
            shift
            ;;
        --no-reports)
            GENERATE_REPORTS=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --standard-only    Run only standard contract tests"
            echo "  --gas-only         Run only gas usage tests"
            echo "  --benchmark-only   Run only gas benchmark tests"
            echo "  --limit-only       Run only gas limit scenario tests"
            echo "  --regression-only  Run only gas regression tests"
            echo "  --no-reports       Skip report generation"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Default: Run all tests and generate reports"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create reports directory
REPORTS_DIR="reports"
GAS_REPORTS_DIR="$REPORTS_DIR/gas"
mkdir -p "$GAS_REPORTS_DIR"

# Function to run standard tests
run_standard_tests() {
    print_status "Running standard contract tests..."
    
    cd contract
    
    # Test ticket contract
    print_status "Testing ticket contract..."
    if cargo test --package ticket_contract 2>&1 | tee "$GAS_REPORTS_DIR/ticket_standard.log"; then
        print_success "Ticket contract tests passed"
    else
        print_error "Ticket contract tests failed"
        return 1
    fi
    
    # Test escrow contract
    print_status "Testing escrow contract..."
    if cargo test --package escrow_contract 2>&1 | tee "$GAS_REPORTS_DIR/escrow_standard.log"; then
        print_success "Escrow contract tests passed"
    else
        print_error "Escrow contract tests failed"
        return 1
    fi
    
    cd ..
}

# Function to run gas usage tests
run_gas_tests() {
    print_status "Running gas usage tests..."
    
    cd contract
    
    # Test ticket contract gas usage
    print_status "Testing ticket contract gas usage..."
    if cargo test --package ticket_contract test_gas 2>&1 | tee "$GAS_REPORTS_DIR/ticket_gas.log"; then
        print_success "Ticket contract gas tests passed"
    else
        print_error "Ticket contract gas tests failed"
        return 1
    fi
    
    # Test escrow contract gas usage
    print_status "Testing escrow contract gas usage..."
    if cargo test --package escrow_contract test_gas 2>&1 | tee "$GAS_REPORTS_DIR/escrow_gas.log"; then
        print_success "Escrow contract gas tests passed"
    else
        print_error "Escrow contract gas tests failed"
        return 1
    fi
    
    cd ..
}

# Function to run gas benchmarks
run_gas_benchmarks() {
    print_status "Running gas benchmark tests..."
    
    cd contract
    
    # Run comprehensive benchmarks
    print_status "Running comprehensive gas benchmarks..."
    if cargo test --package test gas_benchmarks 2>&1 | tee "$GAS_REPORTS_DIR/benchmarks.log"; then
        print_success "Gas benchmarks completed"
    else
        print_error "Gas benchmarks failed"
        return 1
    fi
    
    cd ..
}

# Function to run gas limit tests
run_gas_limit_tests() {
    print_status "Running gas limit scenario tests..."
    
    cd contract
    
    # Run limit scenario tests
    print_status "Testing gas limit scenarios..."
    if cargo test --package test gas_limits 2>&1 | tee "$GAS_REPORTS_DIR/limits.log"; then
        print_success "Gas limit tests completed"
    else
        print_error "Gas limit tests failed"
        return 1
    fi
    
    cd ..
}

# Function to run gas regression tests
run_gas_regression_tests() {
    print_status "Running gas regression tests..."
    
    cd contract
    
    # Run regression monitoring tests
    print_status "Testing for gas regressions..."
    if cargo test --package test gas_regression 2>&1 | tee "$GAS_REPORTS_DIR/regression.log"; then
        print_success "Gas regression tests completed"
    else
        print_error "Gas regression tests failed"
        return 1
    fi
    
    cd ..
}

# Function to generate comprehensive reports
generate_reports() {
    if [ "$GENERATE_REPORTS" = false ]; then
        return
    fi
    
    print_status "Generating comprehensive gas usage reports..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local summary_file="$GAS_REPORTS_DIR/gas_summary_$timestamp.md"
    
    cat > "$summary_file" << EOF
# Gas Usage Test Report

**Generated:** $(date)  
**Test Type:** $TEST_TYPE  
**Environment:** $(uname -a)

## Test Results Summary

EOF

    # Add test results to summary
    if [ "$RUN_STANDARD_TESTS" = true ]; then
        echo "### Standard Tests" >> "$summary_file"
        if [ -f "$GAS_REPORTS_DIR/ticket_standard.log" ]; then
            echo "- Ticket Contract: $(grep "test result" "$GAS_REPORTS_DIR/ticket_standard.log" | tail -1)" >> "$summary_file"
        fi
        if [ -f "$GAS_REPORTS_DIR/escrow_standard.log" ]; then
            echo "- Escrow Contract: $(grep "test result" "$GAS_REPORTS_DIR/escrow_standard.log" | tail -1)" >> "$summary_file"
        fi
        echo "" >> "$summary_file"
    fi
    
    if [ "$RUN_GAS_TESTS" = true ]; then
        echo "### Gas Usage Tests" >> "$summary_file"
        if [ -f "$GAS_REPORTS_DIR/ticket_gas.log" ]; then
            echo "- Ticket Contract Gas Tests: $(grep "test result" "$GAS_REPORTS_DIR/ticket_gas.log" | tail -1)" >> "$summary_file"
        fi
        if [ -f "$GAS_REPORTS_DIR/escrow_gas.log" ]; then
            echo "- Escrow Contract Gas Tests: $(grep "test result" "$GAS_REPORTS_DIR/escrow_gas.log" | tail -1)" >> "$summary_file"
        fi
        echo "" >> "$summary_file"
    fi
    
    if [ "$RUN_BENCHMARKS" = true ]; then
        echo "### Gas Benchmarks" >> "$summary_file"
        if [ -f "$GAS_REPORTS_DIR/benchmarks.log" ]; then
            echo "- Comprehensive Benchmarks: $(grep "test result" "$GAS_REPORTS_DIR/benchmarks.log" | tail -1)" >> "$summary_file"
        fi
        echo "" >> "$summary_file"
    fi
    
    if [ "$RUN_LIMIT_TESTS" = true ]; then
        echo "### Gas Limit Tests" >> "$summary_file"
        if [ -f "$GAS_REPORTS_DIR/limits.log" ]; then
            echo "- Limit Scenario Tests: $(grep "test result" "$GAS_REPORTS_DIR/limits.log" | tail -1)" >> "$summary_file"
        fi
        echo "" >> "$summary_file"
    fi
    
    if [ "$RUN_REGRESSION_TESTS" = true ]; then
        echo "### Gas Regression Tests" >> "$summary_file"
        if [ -f "$GAS_REPORTS_DIR/regression.log" ]; then
            echo "- Regression Monitoring: $(grep "test result" "$GAS_REPORTS_DIR/regression.log" | tail -1)" >> "$summary_file"
        fi
        echo "" >> "$summary_file"
    fi
    
    # Add gas usage analysis
    cat >> "$summary_file" << EOF
## Gas Usage Analysis

### Key Metrics Extracted from Logs

EOF
    
    # Extract gas usage information from logs
    for log_file in "$GAS_REPORTS_DIR"/*.log; do
        if [ -f "$log_file" ]; then
            echo "#### $(basename "$log_file" .log)" >> "$summary_file"
            echo '```' >> "$summary_file"
            
            # Extract gas-related lines
            grep -i "gas\|benchmark\|regression\|limit" "$log_file" | head -20 >> "$summary_file" 2>/dev/null || echo "No gas metrics found" >> "$summary_file"
            
            echo '```' >> "$summary_file"
            echo "" >> "$summary_file"
        fi
    done
    
    # Add recommendations
    cat >> "$summary_file" << EOF
## Recommendations

### Gas Optimization Opportunities

Based on the test results, consider the following optimization strategies:

1. **Batch Operations**: Ensure batch operations are more gas-efficient than individual operations
2. **Storage Optimization**: Review storage patterns for potential gas savings
3. **Computation Efficiency**: Identify computationally intensive operations that can be optimized
4. **Contract Size**: Monitor contract size and consider modular patterns if needed

### Monitoring Guidelines

1. **Continuous Monitoring**: Set up automated gas regression monitoring in CI/CD
2. **Baseline Updates**: Update gas baselines when intentional optimizations are made
3. **Alert Thresholds**: Configure appropriate alert thresholds for different operation types
4. **Regular Benchmarks**: Run comprehensive benchmarks regularly to track trends

## Files Generated

- Standard test logs: \`ticket_standard.log\`, \`escrow_standard.log\`
- Gas test logs: \`ticket_gas.log\`, \`escrow_gas.log\`
- Benchmark results: \`benchmarks.log\`
- Limit test results: \`limits.log\`
- Regression test results: \`regression.log\`

## Next Steps

1. Review any failed tests and address issues
2. Analyze gas usage patterns for optimization opportunities
3. Update baselines if significant improvements are made
4. Configure automated monitoring for production deployments

EOF
    
    print_success "Comprehensive report generated: $summary_file"
    
    # Generate a quick summary for console output
    echo ""
    print_status "Quick Test Summary:"
    echo "======================"
    
    if [ -f "$summary_file" ]; then
        grep -A 20 "### " "$summary_file" | head -20
    fi
    
    echo ""
    print_status "Full report available at: $summary_file"
}

# Main execution
main() {
    print_status "Starting Gathera contract test suite..."
    print_status "Test configuration: $TEST_TYPE"
    
    local start_time=$(date +%s)
    local failed_tests=0
    
    # Run tests based on configuration
    if [ "$RUN_STANDARD_TESTS" = true ]; then
        if ! run_standard_tests; then
            ((failed_tests++))
        fi
    fi
    
    if [ "$RUN_GAS_TESTS" = true ]; then
        if ! run_gas_tests; then
            ((failed_tests++))
        fi
    fi
    
    if [ "$RUN_BENCHMARKS" = true ]; then
        if ! run_gas_benchmarks; then
            ((failed_tests++))
        fi
    fi
    
    if [ "$RUN_LIMIT_TESTS" = true ]; then
        if ! run_gas_limit_tests; then
            ((failed_tests++))
        fi
    fi
    
    if [ "$RUN_REGRESSION_TESTS" = true ]; then
        if ! run_gas_regression_tests; then
            ((failed_tests++))
        fi
    fi
    
    # Generate reports
    generate_reports
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Final summary
    echo ""
    echo "=================================="
    if [ $failed_tests -eq 0 ]; then
        print_success "All tests completed successfully!"
        print_success "Total execution time: ${duration}s"
    else
        print_error "$failed_tests test suites failed!"
        print_warning "Total execution time: ${duration}s"
        echo ""
        print_status "Check the log files in $GAS_REPORTS_DIR for details"
    fi
    echo "=================================="
    
    exit $failed_tests
}

# Run main function
main "$@"