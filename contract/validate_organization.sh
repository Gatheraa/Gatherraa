#!/bin/bash

# Module Organization Validation Script
# Validates that the module organization fixes are properly implemented

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Validation functions
validate_workspace_structure() {
    print_status "Validating workspace structure..."
    
    local required_dirs=("common" "ticket_contract" "escrow_contract" "multisig_wallet_contract" "contracts" "test")
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [ ${#missing_dirs[@]} -eq 0 ]; then
        print_success "All required directories exist"
        return 0
    else
        print_error "Missing directories: ${missing_dirs[*]}"
        return 1
    fi
}

validate_cargo_tomls() {
    print_status "Validating Cargo.toml files..."
    
    local required_tomls=("Cargo.toml" "common/Cargo.toml" "ticket_contract/Cargo.toml" "escrow_contract/Cargo.toml" "multisig_wallet_contract/Cargo.toml" "contracts/Cargo.toml" "test/Cargo.toml")
    local missing_tomls=()
    
    for toml in "${required_tomls[@]}"; do
        if [ ! -f "$toml" ]; then
            missing_tomls+=("$toml")
        fi
    done
    
    if [ ${#missing_tomls[@]} -eq 0 ]; then
        print_success "All required Cargo.toml files exist"
        return 0
    else
        print_error "Missing Cargo.toml files: ${missing_tomls[*]}"
        return 1
    fi
}

validate_lib_files() {
    print_status "Validating lib.rs files..."
    
    local required_libs=("common/src/lib.rs" "ticket_contract/src/lib.rs" "escrow_contract/src/lib.rs" "multisig_wallet_contract/src/lib.rs" "contracts/src/lib.rs" "test/src/lib.rs")
    local missing_libs=()
    
    for lib in "${required_libs[@]}"; do
        if [ ! -f "$lib" ]; then
            missing_libs+=("$lib")
        fi
    done
    
    if [ ${#missing_libs[@]} -eq 0 ]; then
        print_success "All required lib.rs files exist"
        return 0
    else
        print_error "Missing lib.rs files: ${missing_libs[*]}"
        return 1
    fi
}

validate_workspace_members() {
    print_status "Validating workspace members..."
    
    if grep -q "members.*=.*\[.*common.*ticket_contract.*escrow_contract.*multisig_wallet_contract.*contracts.*test.*\]" Cargo.toml; then
        print_success "Workspace members are correctly configured"
        return 0
    else
        print_error "Workspace members are not correctly configured"
        return 1
    fi
}

validate_dependencies() {
    print_status "Validating dependency structure..."
    
    # Check that individual contracts only depend on gathera-common
    local contracts=("ticket_contract" "escrow_contract" "multisig_wallet_contract")
    
    for contract in "${contracts[@]}"; do
        if grep -q "gathera-common" "$contract/Cargo.toml"; then
            print_success "$contract depends on gathera-common"
        else
            print_error "$contract does not depend on gathera-common"
            return 1
        fi
        
        # Check that individual contracts don't depend on each other
        local other_contracts=("${contracts[@]/$contract}")
        for other_contract in "${other_contracts[@]}"; do
            if grep -q "$other_contract" "$contract/Cargo.toml"; then
                print_error "$contract incorrectly depends on $other_contract"
                return 1
            fi
        done
    done
    
    # Check that contracts module depends on all individual contracts
    local integration_deps=("gathera-common" "ticket_contract" "escrow_contract" "multisig_wallet_contract")
    for dep in "${integration_deps[@]}"; do
        if grep -q "$dep" "contracts/Cargo.toml"; then
            print_success "contracts module depends on $dep"
        else
            print_error "contracts module does not depend on $dep"
            return 1
        fi
    done
    
    return 0
}

validate_documentation() {
    print_status "Validating documentation..."
    
    local docs=("README.md" "DEPENDENCY_ANALYSIS.md")
    local missing_docs=()
    
    for doc in "${docs[@]}"; do
        if [ ! -f "$doc" ]; then
            missing_docs+=("$doc")
        fi
    done
    
    if [ ${#missing_docs[@]} -eq 0 ]; then
        print_success "All required documentation files exist"
        return 0
    else
        print_error "Missing documentation files: ${missing_docs[*]}"
        return 1
    fi
}

validate_module_boundaries() {
    print_status "Validating module boundaries..."
    
    # Check that gathera-common doesn't depend on other contracts
    if grep -q "ticket_contract\|escrow_contract\|multisig_wallet_contract\|contracts" common/Cargo.toml; then
        print_error "gathera-common has invalid dependencies"
        return 1
    else
        print_success "gathera-common has no contract dependencies"
    fi
    
    return 0
}

# Main validation
main() {
    print_status "Starting module organization validation..."
    
    local validations=(
        "validate_workspace_structure"
        "validate_cargo_tomls"
        "validate_lib_files"
        "validate_workspace_members"
        "validate_dependencies"
        "validate_documentation"
        "validate_module_boundaries"
    )
    
    local failed_validations=0
    
    for validation in "${validations[@]}"; do
        if ! $validation; then
            ((failed_validations++))
        fi
    done
    
    echo
    if [ $failed_validations -eq 0 ]; then
        print_success "All validations passed! Module organization is correct."
        print_status "Issue #316: Missing Module Organization has been resolved."
        return 0
    else
        print_error "$failed_validations validation(s) failed."
        return 1
    fi
}

# Run validation
main "$@"
