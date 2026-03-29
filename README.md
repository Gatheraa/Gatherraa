# Gathera

> Open-source infrastructure for Web3 events and conferences.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Rust](https://img.shields.io/badge/Built%20with-Rust-orange.svg)](https://www.rust-lang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-blue.svg)](https://stellar.org/soroban)
[![NestJS](https://img.shields.io/badge/NestJS-Framework-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-Framework-black.svg)](https://nextjs.org/)

## Overview

Gathera is a comprehensive, open-source platform designed to power Web3 events and conferences on the Stellar blockchain. It combines Soroban smart contract-based ticketing, decentralized identity verification, and seamless event management to create a trustless, transparent ecosystem for organizers and attendees.

## Features

- **Blockchain Ticketing**: Soroban-powered NFT tickets with anti-scalping mechanisms
- **Decentralized Identity**: Stellar-based identity verification for attendees
- **Event Management**: Full-featured dashboard for organizers
- **Fast Finality**: 5-second transaction finality on Stellar
- **Soroban Integration**: Rust-based smart contracts with WebAssembly execution

## Architecture

```
Gathera/
├── app/
│   ├── backend/          # NestJS API server
│   └── frontend/         # Next.js 16 + React 19 application
├── contract/             # Smart contracts (Rust/Soroban)
│   ├── contracts/        # Rust smart contract source
│   ├── scripts/          # Deployment and utility scripts
│   └── test/             # Contract test suites
```

## Tech Stack

### Smart Contracts
- **Platform**: Stellar Soroban
- **Language**: Rust (compiles to WebAssembly)
- **SDK**: Soroban Rust SDK
- **Testing**: Soroban CLI + Rust test framework
- **Deployment**: Soroban CLI

### Backend
- **Framework**: NestJS 11
- **Language**: TypeScript 5.7
- **Testing**: Jest 30
- **API**: RESTful + GraphQL ready

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Font**: Geist (Vercel)

## Getting Started

### Prerequisites

- Node.js 20+
- Rust 1.74+
- Soroban CLI
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Gatheraa/Gathera.git
cd Gathera

# Install contract dependencies
cd contract
npm install

# Install backend dependencies
cd ../app/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Development Environment

**Smart Contracts:**
```bash
cd contract
# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Test contracts
cargo test

# Deploy to testnet
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/[contract].wasm --source [key] --network testnet
```

**Backend:**
```bash
cd app/backend
npm run start:dev
```

**Frontend:**
```bash
cd app/frontend
npm run dev
```

## Development

### Contract Development

The smart contracts are written in Rust for Stellar Soroban, compiling to WebAssembly for efficient execution on the Stellar network.

```bash
cd contract
# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test

# Deploy to futurenet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gathera_event.wasm \
  --source [your_key] \
  --network futurenet

# Invoke contract function
soroban contract invoke \
  --id [contract_id] \
  --source [your_key] \
  --network futurenet \
  -- \
  create_event \
  --organizer [address] \
  --name "Event Name"
```

### Backend Development

The NestJS backend provides RESTful APIs for event management, user authentication, and blockchain interactions.

```bash
cd app/backend
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod

# Run tests
npm run test
npm run test:e2e
```

### Frontend Development

The Next.js frontend offers a modern, responsive UI for event discovery, ticket purchasing, and attendee management.

```bash
cd app/frontend
# Development server
npm run dev

# Production build
npm run build
npm run start
```

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Community

- [Discord](https://discord.gg/gathera)
- [Twitter](https://twitter.com/gathera)
- [Documentation](https://docs.gathera.io)

## Acknowledgments

- Built with [Stellar Soroban](https://soroban.stellar.org/)
- Powered by [Stellar](https://stellar.org/)
- Frontend by [Next.js](https://nextjs.org/)
- Backend by [NestJS](https://nestjs.com/)
