# Fuzzing Tests for Soroban Smart Contracts

This directory contains comprehensive fuzzing tests for critical smart contract functions in the Gatherraa platform.

## 🎯 Overview

Fuzzing is an automated testing technique that provides random, invalid, or unexpected inputs to discover:
- Security vulnerabilities
- Edge cases
- Panic conditions
- Assertion failures
- Memory safety issues

## 📁 Structure

```
fuzz/
├── Cargo.toml                    # Workspace configuration
├── fuzz_targets/                 # Fuzzer implementations
│   ├── ticket_mint_fuzzer.rs
│   ├── ticket_purchase_fuzzer.rs
│   ├── escrow_create_fuzzer.rs
│   ├── escrow_release_fuzzer.rs
│   ├── atomic_ops_fuzzer.rs
│   ├── governance_vote_fuzzer.rs
│   └── multisig_exec_fuzzer.rs
├── corpora/                      # Seed inputs
│   └── [fuzzer_name]/
├── artifacts/                    # Crash reports (generated)
│   └── [fuzzer_name]/
└── src/
    └── lib.rs                    # Shared fuzzing utilities
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install Rust toolchain
rustup update stable

# Install cargo-fuzz
cargo install cargo-fuzz
```

### Build Fuzzers

```bash
cd fuzz

# Build all fuzzers
cargo fuzz build

# Build specific fuzzer
cargo fuzz build ticket_mint_fuzzer
```

### Run Fuzzing

```bash
# Run with default settings
cargo fuzz run ticket_mint_fuzzer

# Run with timeout (seconds)
cargo fuzz run ticket_mint_fuzzer --timeout=60

# Run with AddressSanitizer
cargo fuzz run ticket_mint_fuzzer --sanitizer=address

# Run for specific time
cargo fuzz run ticket_mint_fuzzer --max_total_time=3600
```

### Analyze Results

```bash
# View coverage report
cargo fuzz coverage ticket_mint_fuzzer

# Minimize corpus
cargo fuzz cmin ticket_mint_fuzzer

# Reproduce crash
cargo fuzz run ticket_mint_fuzzer fuzz/artifacts/ticket_mint_fuzzer/crash-abc123
```

## 🧪 Available Fuzzers

### 1. Ticket Mint Fuzzer
**Target**: `ticket_contract::mint_ticket()`

Tests:
- Various metadata formats
- Invalid recipient addresses
- Edge case token IDs
- Concurrent minting scenarios

```bash
cargo fuzz run ticket_mint_fuzzer
```

### 2. Ticket Purchase Fuzzer
**Target**: `ticket_contract::purchase_ticket()`

Tests:
- Different payment amounts
- Timestamp edge cases
- Rate limiting scenarios
- Pricing strategy variations

```bash
cargo fuzz run ticket_purchase_fuzzer
```

### 3. Escrow Create Fuzzer
**Target**: `escrow_contract::create_escrow()`

Tests:
- Invalid address combinations
- Amount boundary conditions
- Revenue split configurations
- Milestone structures

```bash
cargo fuzz run escrow_create_fuzzer
```

### 4. Escrow Release Fuzzer
**Target**: `escrow_contract::release_funds()`

Tests:
- Premature release attempts
- Invalid status transitions
- Multi-party authorization
- Split distribution logic

```bash
cargo fuzz run escrow_release_fuzzer
```

### 5. Atomic Operations Fuzzer
**Target**: `cross_contract_contract::execute_atomic_operation()`

Tests:
- Multi-call sequences
- Circular dependencies
- Rollback scenarios
- Callback chains

```bash
cargo fuzz run atomic_ops_fuzzer
```

### 6. Governance Vote Fuzzer
**Target**: `governance_contract::vote()`

Tests:
- Double voting attempts
- Invalid proposal IDs
- Voting power calculations
- Quorum edge cases

```bash
cargo fuzz run governance_vote_fuzzer
```

### 7. Multisig Execution Fuzzer
**Target**: `multisig_wallet_contract::execute_transaction()`

Tests:
- Insufficient confirmations
- Duplicate confirmations
- Transaction replay attacks
- Threshold boundaries

```bash
cargo fuzz run multisig_exec_fuzzer
```

## 📊 Coverage Monitoring

### Generate Coverage Report

```bash
# Install grcov
cargo install grcov

# Run fuzzer with coverage
RUSTFLAGS="-C instrument-coverage" cargo fuzz run ticket_mint_fuzzer --dev-mode

# Generate HTML report
grcov . -s . --binary-path ./target/x86_64-unknown-linux-gnu/release/ticket_mint_fuzzer \
    -t html --branch --ignore-not-existing -o coverage_report/
```

### View Coverage

Open `coverage_report/index.html` in your browser to see detailed coverage metrics.

## 🐛 Handling Crashes

When a crash is found:

1. **Automatic Save**: Crash input saved to `artifacts/[fuzzer]/crash-[hash]`

2. **Reproduce**:
   ```bash
   cargo fuzz run [fuzzer] fuzz/artifacts/[fuzzer]/crash-[hash]
   ```

3. **Analyze**: Check panic message and stack trace

4. **Fix**: Address the vulnerability in contract code

5. **Verify**: Re-run fuzzer to ensure fix works

## 🔧 Advanced Usage

### Custom Corpora

Create seed inputs in `corpora/[fuzzer_name]/`:

```bash
# Add custom seed
echo -ne '\x01\x02\x03\x04' > corpora/ticket_mint_fuzzer/seed_1

# Merge with existing corpus
cargo fuzz merge ticket_mint_fuzzer
```

### Dictionary-Based Fuzzing

Create `fuzz/dictionaries/soroban.dict`:

```
# Soroban function names
"mint"
"transfer"
"burn"
"approve"

# Common addresses (hex encoded)
"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
```

Use with:
```bash
cargo fuzz run ticket_mint_fuzzer --dictionary=fuzz/dictionaries/soroban.dict
```

### Parallel Fuzzing

```bash
# Run multiple instances
cargo fuzz run ticket_mint_fuzzer -j 4

# Specific jobs
cargo fuzz run ticket_mint_fuzzer --jobs=8
```

## 📈 Metrics Dashboard

### Prometheus Metrics

Export fuzzer metrics to Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'fuzzing'
    static_configs:
      - targets: ['localhost:9090']
```

Key metrics:
- `fuzz_executions_per_second`
- `fuzz_corpus_size`
- `fuzz_coverage_edges`
- `fuzz_crashes_total`

### Grafana Dashboard

Import dashboard from `monitoring/fuzzing-dashboard.json`

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Fuzzing

on: [push, pull_request]

jobs:
  fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install cargo-fuzz
        run: cargo install cargo-fuzz
      
      - name: Build fuzzers
        run: cd fuzz && cargo fuzz build
      
      - name: Run fuzzing
        run: cd fuzz && cargo fuzz run ticket_mint_fuzzer --max_total_time=300
```

### Scheduled Fuzzing

Weekly 24-hour runs:

```yaml
schedule:
  - cron: '0 0 * * 0'  # Every Sunday at midnight
```

## 🛡️ Security Best Practices

1. **Run with sanitizers**: Always use ASAN/UBSAN in production fuzzing
2. **Long-running sessions**: Schedule extended runs (24h+) weekly
3. **Monitor crashes**: Set up alerts for new crashes
4. **Triage regularly**: Review and fix crashes promptly
5. **Expand corpus**: Continuously add interesting inputs
6. **Share findings**: Document discovered issues and fixes

## 📚 Resources

- [cargo-fuzz Book](https://rust-fuzz.github.io/book/cargo-fuzz.html)
- [libFuzzer Documentation](https://llvm.org/docs/LibFuzzer.html)
- [Soroban Testing Guide](https://soroban.stellar.org/docs/test)

## 🤝 Contributing

To add new fuzzers:

1. Create `fuzz_targets/[contract]_[function]_fuzzer.rs`
2. Add to `Cargo.toml` [[bin]] section
3. Create seed corpus in `corpora/[fuzzer_name]/`
4. Update this README
5. Add to CI/CD pipeline

## 📄 License

Same as the main project license.

---

**Happy Fuzzing!** 🎉
