# Multisig Wallet Contract

The `multisig_wallet_contract` provides organizational fund management with multi-signature transaction approval and configurable thresholds.

## Features

- **Multi-Owner Support**: Multiple addresses can be granted ownership with distinct voting power.
- **Configurable Threshold**: Set the required number of approvals for transaction execution.
- **Transaction Life-cycle**: Propose, approve, and execute transactions from the wallet.
- **Time-lock Support**: Optional delay for sensitive operations.

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
  --wasm ../target/wasm32-unknown-unknown/release/multisig_wallet_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- `soroban-sdk`: Core Soroban development kit.
- `gathera-common`: Shared types and utilities.

## Troubleshooting

- **Approvals Not Counting**: Ensure the approver is a current owner and hasn't already signed the transaction.
- **Threshold Change**: Modifying the threshold requires careful coordination to avoid lockouts.
