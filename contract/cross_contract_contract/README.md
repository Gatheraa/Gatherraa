# Cross Contract Contract

The `cross_contract_contract` provides an orchestration layer for complex, multi-contract operations within the Gathera ecosystem.

## Features

- **Atomic Multi-contract Execution**: Group multiple contract calls into a single transaction.
- **Rollback Mechanics**: Ensures that if one part of a multi-step operation fails, the entire transaction is rolled back.
- **Unified State Management**: Coordinate state between ticketing, escrow, and multisig.

## Getting Started

### Prerequisites

- Rust 1.74+
- `wasm32-unknown-unknown` target
- Soroban CLI

### Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Deployment

```bash
soroban contract deploy \
  --wasm ../target/wasm32-unknown-unknown/release/cross_contract_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- All other Gathera contracts (referenced via ID or WASM).

## Troubleshooting

- **Call Failure**: If a sub-call fails, the entire transaction will revert. Inspect sub-call logs if possible.
- **Gas Limit**: Since this contract interacts with multiple others, it often hits the default Soroban gas limits.
