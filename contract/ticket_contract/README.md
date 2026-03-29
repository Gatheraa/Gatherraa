# Ticket Contract

The `ticket_contract` implements the core soulbound ticketing system for the Gathera platform. It handles ticket issuance, attendance verification, and event synchronization.

## Features

- **Soulbound Mechanism**: Non-transferable tickets linked to an attendee's identity.
- **Event-Based Issuance**: Streamlined ticket creation for specific events.
- **Verification API**: Simple on-chain methods for gatekeepers to verify tickets.
- **Escrow Integration**: Pluggable support for payment processing through Gathera Escrow.

## Getting Started

### Prerequisites

- Rust 1.74+
- `wasm32-unknown-unknown` target
- Soroban CLI

### Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM will be located in `target/wasm32-unknown-unknown/release/ticket_contract.wasm`.

### Deployment

```bash
soroban contract deploy \
  --wasm ../target/wasm32-unknown-unknown/release/ticket_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- `soroban-sdk`: Core Soroban development kit.
- `gathera-common`: Shared types and utilities.

## Troubleshooting

- **Verification Fails**: Check if the ticket ID exists and the attendee address is correct.
- **Gas Limit Exceeded**: Ticket minting with large metadata may require higher gas limits.
