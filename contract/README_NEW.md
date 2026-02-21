# Gathera Smart Contracts

This repository contains the smart contracts for the Gathera platform - a decentralized event management system built on Stellar using Soroban smart contracts.

## Contract Overview

The project includes multiple smart contracts that work together to provide a complete event management solution:

### 1. Identity Registry Contract (`identity_contract/`)
A decentralized identity management system that allows users to create and manage Web3 identities with:
- DID (Decentralized Identifier) creation and resolution
- Multi-claim support (Twitter, GitHub, email, etc.)
- Oracle-based credential verification
- Reputation scoring system
- Delegation for identity management
- Privacy-preserving selective disclosure
- Revocation mechanisms for compromised credentials

### 2. Event Factory Contract (`event_factory_contract/`)
Manages the creation and deployment of individual event contracts with:
- Event contract deployment
- Organizer management
- Event ownership transfer
- Factory pausing functionality

### 3. Ticket Contract (`ticket_contract/`)
Handles soulbound NFT ticketing with anti-scalping features:
- Dynamic pricing strategies
- Oracle-integrated price adjustments
- Soulbound (non-transferable) tickets
- Tier-based ticket management
- Refund mechanisms

### 4. Staking Contract (`contracts/`)
Provides staking functionality for the platform:
- Tier-based staking rewards
- Lock-up periods with boosting
- Reward compounding
- Emergency withdrawal with penalties

## Usage

### Building Contracts

Each contract can be built independently:

```shell
# Build Identity Contract
cd identity_contract
cargo build --target wasm32-unknown-unknown --release

# Build Event Factory Contract
cd ../event_factory_contract
cargo build --target wasm32-unknown-unknown --release

# Build Ticket Contract
cd ../ticket_contract
cargo build --target wasm32-unknown-unknown --release

# Build Staking Contract
cd ../contracts
cargo build --target wasm32-unknown-unknown --release
```

### Running Tests

Run tests for individual contracts:

```shell
# Test Identity Contract
cd identity_contract
cargo test

# Test Event Factory Contract
cd ../event_factory_contract
cargo test

# Test Ticket Contract
cd ../ticket_contract
cargo test

# Test Staking Contract
cd ../contracts
cargo test
```

### Deployment

Each contract includes a deployment script:

```shell
# Deploy Identity Contract
cd identity_contract
./deploy.sh

# Deploy Event Factory Contract
cd ../event_factory_contract
./deploy.sh

# Deploy Ticket Contract
cd ../ticket_contract
./deploy.sh

# Deploy Staking Contract
cd ../contracts
./deploy.sh
```

### Contract Documentation

Each contract has detailed documentation:

- **Identity Contract**: [identity_contract/README.md](identity_contract/README.md) and [identity_contract/USAGE.md](identity_contract/USAGE.md)
- **Event Factory Contract**: [event_factory_contract/README.md](event_factory_contract/README.md)
- **Ticket Contract**: [ticket_contract/README.md](ticket_contract/README.md)
- **Staking Contract**: [contracts/README.md](contracts/README.md)

## Integration

The contracts are designed to work together:

1. **Identity Contract** provides user identities and reputation for **Ticket Contract** access control
2. **Event Factory Contract** creates individual **Ticket Contracts** for each event
3. **Staking Contract** provides economic incentives and governance
4. All contracts follow consistent patterns for storage, authentication, and error handling

## Development

### Prerequisites

- Rust toolchain with wasm32-unknown-unknown target
- Soroban CLI
- Stellar testnet or local network access

### Adding New Features

1. Follow the existing contract patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure proper error handling
5. Maintain storage efficiency

### Security Considerations

- All contracts implement proper authentication
- Storage patterns are optimized for cost efficiency
- Emergency pause mechanisms are included
- Delegation and revocation systems provide security controls