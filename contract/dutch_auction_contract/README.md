# Dutch Auction Contract

The `dutch_auction_contract` implements a linear price-decay auction for premium tickets on the Gathera platform.

## Features

- **Linear Price Decay**: Start at a ceiling price and drop linearly over time to a floor price.
- **Fair Participation**: Allows open bidding with instant settlement.
- **WASM Optimized**: Tiny footprint for efficient Soroban execution.
- **Integration**: Direct links to the ticketing and escrow system.

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
  --wasm ../target/wasm32-unknown-unknown/release/dutch_auction_contract.wasm \
  --source [YOUR_KEY] \
  --network testnet
```

## Dependencies

- `soroban-sdk`: Core Soroban development kit.

## Troubleshooting

- **No Active Bid**: An auction must be explicitly started before bids can be accepted.
- **Zero Result**: Price calculation might return 0 if the floor price is reached or duration exceeded.
