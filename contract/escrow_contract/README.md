# Escrow Contract

The `escrow_contract` provides secure fund management for events, allowing for conditional releases, revenue splitting, and dispute resolution.

## Features

- **Revenue Splitting**: Automatically distribute funds between organizers, partners, and service providers.
- **Conditional Release**: Trigger funds release based on event milestones or attendance.
- **Auto-Release**: Time-locked safety mechanism to prevent fund lock-in.
- **Dispute Handling**: Integrated logic for handling disputed tickets and refunds.

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
  --wasm ../target/wasm32-unknown-unknown/release/escrow_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- `soroban-sdk`: Core Soroban development kit.
- `gathera-common`: Shared types and utilities.

## Troubleshooting

- **Release Fails**: Ensure all condition bits are set according to the milestone definition.
- **Insufficient Funds**: Check the current balance of the escrow instance before initiating a release.
