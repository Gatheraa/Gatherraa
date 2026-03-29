# Gathera Common Utility Library

The `gathera-common` module provides shared data structures, constants, and utilities used throughout the Gathera smart contract ecosystem.

## Features

- **Standard Types**: Consistent definitions for addresses, ticket IDs, and statuses.
- **Gas Measurement**: Utility traits and macros for benchmarking contract efficiency.
- **Errors**: Centralized error mapping for clear cross-contract debugging.
- **Math Ops**: Safe arithmetic helpers with platform-optimized checks.

## Getting Started

### Prerequisites

- Rust 1.74+

### Building

```bash
cargo build --release
```

This is a library crate and should be referenced in other contracts' `Cargo.toml`.

## Dependencies

- `soroban-sdk`: Core Soroban development kit.

## Troubleshooting

- **Symbol Collision**: Ensure all macros are imported with the `gathera_common::` prefix.
- **Workspace Link Errors**: Verify that the `Cargo.toml` workspace configuration matches the project layout.
