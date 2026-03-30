#!/bin/bash

# Security Test Runner Script for Gatheraa Smart Contracts
# This script runs comprehensive security tests for all contracts

set -e  # Exit on any error

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

# Function to run tests for a specific contract
run_contract_tests() {
    local contract_dir=$1
    local contract_name=$2
    
    print_status "Running security tests for $contract_name..."
    
    if [ ! -d "$contract_dir" ]; then
        print_error "Contract directory $contract_dir not found!"
        return 1
    fi
    
    cd "$contract_dir"
    
    # Check if Cargo.toml exists
    if [ ! -f "Cargo.toml" ]; then
        print_error "Cargo.toml not found in $contract_dir"
        cd ..
        return 1
    fi
    
    # Run security tests
    print_status "Executing: cargo test --test security_tests --verbose"
    
    if cargo test --test security_tests --verbose; then
        print_success "All security tests passed for $contract_name!"
    else
        print_error "Security tests failed for $contract_name!"
        cd ..
        return 1
    fi
    
    cd ..
}

# Function to run specific test categories
run_test_category() {
    local category=$1
    local contract_dir=$2
    
    print_status "Running $category security tests..."
    
    cd "$contract_dir"
    
    case $category in
        "reentrancy")
            cargo test reentrancy --verbose
            ;;
        "overflow")
            cargo test overflow --verbose
            ;;
        "access_control")
            cargo test access_control --verbose
            ;;
        "front_running")
            cargo test front_running --verbose
            ;;
        "oracle")
            cargo test oracle --verbose
            ;;
        "edge_case")
            cargo test edge_case --verbose
            ;;
        *)
            print_error "Unknown test category: $category"
            cd ..
            return 1
            ;;
    esac
    
    local result=$?
    cd ..
    
    if [ $result -eq 0 ]; then
        print_success "$category tests passed!"
    else
        print_error "$category tests failed!"
        return 1
    fi
}

# Function to generate security test report
generate_report() {
    local report_file="security_test_report_$(date +%Y%m%d_%H%M%S).txt"
    
    print_status "Generating security test report: $report_file"
    
    cat > "$report_file" << EOF
Gatheraa Smart Contracts Security Test Report
============================================
Generated: $(date)

Test Environment:
- Rust: $(rustc --version)
- Soroban CLI: $(soroban --version 2>/dev/null || echo "Not installed")
- OS: $(uname -s)

Test Results:
EOF

    local all_passed=true
    
    for contract_dir in escrow_contract ticket_contract; do
        if [ -d "$contract_dir" ]; then
            print_status "Testing $contract_dir..."
            cd "$contract_dir"
            
            echo "" >> "../$report_file"
            echo "Contract: $contract_dir" >> "../$report_file"
            echo "---------------------" >> "../$report_file"
            
            if cargo test --test security_tests >> "../$report_file" 2>&1; then
                echo "Status: PASSED" >> "../$report_file"
                print_success "$contract_dir security tests passed"
            else
                echo "Status: FAILED" >> "../$report_file"
                print_error "$contract_dir security tests failed"
                all_passed=false
            fi
            
            cd ..
        fi
    done
    
    echo "" >> "$report_file"
    echo "Overall Status: $([ "$all_passed" = true ] && echo "PASSED" || echo "FAILED")" >> "$report_file"
    
    print_success "Security test report generated: $report_file"
    
    if [ "$all_passed" = false ]; then
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Rust installation
    if ! command -v rustc &> /dev/null; then
        print_error "Rust is not installed. Please install Rust first."
        echo "Visit: https://rustup.rs/"
        exit 1
    fi
    
    # Check Cargo
    if ! command -v cargo &> /dev/null; then
        print_error "Cargo is not installed."
        exit 1
    fi
    
    # Check Soroban CLI (optional)
    if command -v soroban &> /dev/null; then
        print_success "Soroban CLI is installed"
    else
        print_warning "Soroban CLI is not installed. Some features may not work."
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup test environment
setup_environment() {
    print_status "Setting up test environment..."
    
    # Set environment variables for testing
    export RUST_BACKTRACE=1
    export RUST_LOG=debug
    
    # Ensure we're in the contract directory
    if [ ! -f "Cargo.toml" ]; then
        print_error "Please run this script from the contract directory"
        exit 1
    fi
    
    print_success "Test environment setup completed"
}

# Function to clean test artifacts
clean_tests() {
    print_status "Cleaning test artifacts..."
    
    for contract_dir in escrow_contract ticket_contract; do
        if [ -d "$contract_dir" ]; then
            cd "$contract_dir"
            cargo clean
            cd ..
        fi
    done
    
    print_success "Test artifacts cleaned"
}

# Main script execution
main() {
    echo "========================================"
    echo "Gatheraa Security Test Runner"
    echo "========================================"
    
    # Parse command line arguments
    case "${1:-all}" in
        "all")
            check_prerequisites
            setup_environment
            clean_tests
            
            local all_passed=true
            
            for contract_dir in escrow_contract ticket_contract; do
                if [ -d "$contract_dir" ]; then
                    if ! run_contract_tests "$contract_dir" "$contract_dir"; then
                        all_passed=false
                    fi
                else
                    print_warning "Contract directory $contract_dir not found, skipping..."
                fi
            done
            
            if [ "$all_passed" = true ]; then
                print_success "All security tests passed! 🎉"
                generate_report
            else
                print_error "Some security tests failed! ❌"
                generate_report
                exit 1
            fi
            ;;
        "escrow")
            check_prerequisites
            setup_environment
            run_contract_tests "escrow_contract" "Escrow Contract"
            ;;
        "ticket")
            check_prerequisites
            setup_environment
            run_contract_tests "ticket_contract" "Ticket Contract"
            ;;
        "reentrancy"|"overflow"|"access_control"|"front_running"|"oracle"|"edge_case")
            check_prerequisites
            setup_environment
            
            for contract_dir in escrow_contract ticket_contract; do
                if [ -d "$contract_dir" ]; then
                    run_test_category "$1" "$contract_dir"
                fi
            done
            ;;
        "report")
            generate_report
            ;;
        "clean")
            clean_tests
            ;;
        "help")
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  all              - Run all security tests (default)"
            echo "  escrow           - Run escrow contract security tests"
            echo "  ticket           - Run ticket contract security tests"
            echo "  reentrancy       - Run reentrancy attack tests"
            echo "  overflow         - Run overflow/underflow tests"
            echo "  access_control   - Run access control tests"
            echo "  front_running    - Run front-running tests"
            echo "  oracle           - Run oracle manipulation tests"
            echo "  edge_case        - Run edge case and boundary tests"
            echo "  report           - Generate security test report"
            echo "  clean            - Clean test artifacts"
            echo "  help             - Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0               # Run all security tests"
            echo "  $0 escrow        # Run only escrow contract tests"
            echo "  $0 reentrancy    # Run only reentrancy tests"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Trap to handle interruption
trap 'print_warning "Test execution interrupted"; exit 130' INT

# Run main function with all arguments
main "$@"
