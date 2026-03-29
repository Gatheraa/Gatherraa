# ZK Ticket Contract

The `zk_ticket_contract` enables anonymous ticket verification using on-chain Zero-Knowledge Proofs (ZKP). It allows attendees to prove they hold a valid ticket without revealing their address or ticket ID.

## Features

- **ZK Proof Verification**: Validates Groth16 or Plonk proofs on-chain.
- **Privacy-First**: No persistent link between attendee on-chain address and ticket.
- **Nullifier Support**: Prevents double-attendance using the same ticket.

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
  --wasm ../target/wasm32-unknown-unknown/release/zk_ticket_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- `soroban-sdk`: Core Soroban development kit.
- `gathera-common`: Shared types and utilities.

## Troubleshooting

- **Verification Failed**: Check the proof format and the nullifier hash.
- **Gas Usage**: ZK verification can be computationally intensive; ensure the gas limit is set correctly.
