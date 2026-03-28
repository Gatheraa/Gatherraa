# Gatheraa Integration Tests

Comprehensive integration test suite for Gatheraa smart contracts, covering cross-contract interactions, token operations, end-to-end scenarios, and contract upgrades.

## Overview

This integration test framework provides:
- **Cross-Contract Integration Tests**: Tests for contract interactions, registry, atomic operations
- **Token Interaction Tests**: ERC20, ERC721, ERC1155 token operations and interactions
- **End-to-End Scenario Tests**: Complete event lifecycle, payment flows, governance
- **Contract Upgrade Tests**: Version management, state preservation, dependency handling

## Prerequisites

### Required Tools
- Node.js (v18 or higher)
- npm or yarn
- Git

### Dependencies
```bash
# Install all dependencies
npm install
```

## Project Structure

```
tests/integration/
├── contracts/                  # Mock contracts for testing
│   ├── MockERC20.sol
│   ├── MockERC721.sol
│   └── MockERC1155.sol
├── test/
│   ├── helpers/                 # Test utilities
│   │   ├── contracts.ts       # Contract deployment helpers
│   │   ├── tokens.ts          # Token management utilities
│   │   └── orchestrator.ts    # Cross-contract orchestration
│   ├── cross-contract/          # Cross-contract tests
│   │   └── cross-contract.test.ts
│   ├── token-interactions/      # Token interaction tests
│   │   └── token-interactions.test.ts
│   ├── end-to-end/              # End-to-end scenario tests
│   │   └── scenarios.test.ts
│   └── upgrades/                # Contract upgrade tests
│       └── contract-upgrades.test.ts
├── package.json
├── hardhat.config.ts
├── tsconfig.json
└── .env.example
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key environment variables:
- `SEPOLIA_RPC_URL`: RPC endpoint for Sepolia testnet
- `SEPOLIA_PRIVATE_KEY`: Private key for testnet deployments
- `MAINNET_RPC_URL`: RPC endpoint for mainnet
- `MAINNET_PRIVATE_KEY`: Private key for mainnet (production)

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites

```bash
# Cross-contract integration tests
npm run test:cross-contract

# Token interaction tests
npm run test:token-interactions

# End-to-end scenario tests
npm run test:end-to-end

# Contract upgrade tests
npm run test:upgrades
```

### Run with Coverage
```bash
npx hardhat coverage
```

### Run on Specific Network
```bash
# Local network
npx hardhat test --network hardhat

# Sepolia testnet
npx hardhat test --network sepolia
```

## Test Categories

### 1. Cross-Contract Integration Tests

Tests for the CrossContractOrchestrator contract:

- **Contract Registration**: Registry operations, type management
- **Cross-Contract Calls**: Single and batch call execution
- **Atomic Operations**: All-or-nothing transaction groups
- **Callback System**: Event-driven contract interactions
- **Dependency Management**: Circular dependency detection
- **Permission Control**: Access control validation

### 2. Token Interaction Tests

Comprehensive token standard testing:

- **ERC20 Tests**:
  - Token deployment and minting
  - Transfers and allowances
  - Multi-token interactions
  - Token burning

- **ERC721 Tests**:
  - NFT minting and transfers
  - Batch operations
  - Approval mechanisms
  - Ownership tracking

- **ERC1155 Tests**:
  - Multi-token minting
  - Batch transfers
  - Fungible and non-fungible handling

### 3. End-to-End Scenario Tests

Real-world usage scenarios:

- **Event Lifecycle**: Creation → Ticketing → Attendance
- **Payment Flows**: Multi-currency, escrow, settlements
- **Governance**: Token-based voting
- **Refunds**: Cancellation and refund flows
- **Subscriptions**: Recurring access control
- **Whitelist Management**: Exclusive access control

### 4. Contract Upgrade Tests

Upgrade mechanism validation:

- **Version Management**: Registry updates, version tracking
- **State Preservation**: Balance and ownership migration
- **Authorization**: Access control for upgrades
- **Dependency Management**: Upgrade safety checks
- **Rollback Support**: Version reverting
- **Atomic Upgrades**: Multi-contract coordinated upgrades

## Writing New Tests

### Test Structure

```typescript
import { expect } from "chai";
import { network } from "hardhat";
import { ContractManager, TestEnvironment } from "../helpers/contracts";

const { ethers } = await network.connect();

describe("Test Suite Name", function () {
  let testEnv: TestEnvironment;
  let contractManager: ContractManager;

  beforeEach(async function () {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    contractManager = testEnv.contractManager;
  });

  afterEach(async function () {
    await testEnv.teardown();
  });

  it("Should do something", async function () {
    // Test implementation
  });
});
```

### Using Helpers

#### Contract Deployment
```typescript
const deployment = await contractManager.deployContract(
  "ContractName",
  [constructorArg1, constructorArg2],
  0 // signer index
);
```

#### Token Operations
```typescript
const tokenManager = new TokenManager();
const token = await tokenManager.deployERC20("Name", "SYMBOL", "1000000", 18);
await tokenManager.mintERC20("SYMBOL", userAddress, "1000");
```

#### Cross-Contract Orchestration
```typescript
const orchestrator = new CrossContractOrchestrator();
await orchestrator.initialize(orchestratorContract);

// Register contract
await orchestrator.registerContract(
  contractAddress,
  "contract_type",
  1,
  permissions,
  dependencies
);

// Execute cross-contract call
const result = await orchestrator.executeSingleCall(
  targetContract,
  "functionName",
  [arg1, arg2]
);
```

## Test Utilities

### Snapshot Management
```typescript
// Take snapshot before test
const snapshotId = await testEnv.takeSnapshot();

// Revert to snapshot after test
await testEnv.revertSnapshot(snapshotId);

// Or use automatic cleanup
await testEnv.teardown();
```

### Time Manipulation
```typescript
// Increase time
await testEnv.increaseTime(3600); // 1 hour

// Mine blocks
await testEnv.mineBlocks(10);

// Get current timestamp
const timestamp = await testEnv.getCurrentTimestamp();
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Compile contracts
        run: npm run build
        
      - name: Run tests
        run: npm test
```

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure Hardhat node is running
   ```bash
   npx hardhat node
   ```

2. **Timeout Errors**: Increase timeout in `hardhat.config.ts`
   ```typescript
   mocha: {
     timeout: 120000,
   }
   ```

3. **Out of Gas**: Check gas limits in network configuration

4. **Nonce Errors**: Reset account nonce
   ```bash
   npx hardhat clean
   ```

## Contributing

1. Write tests in appropriate category folder
2. Use helper utilities for consistency
3. Include both success and failure cases
4. Add descriptive test names
5. Clean up resources in `afterEach`

## Coverage

Generate coverage report:
```bash
npx hardhat coverage
```

View coverage report in `coverage/` directory.

## License

This project is licensed under the ISC License.
