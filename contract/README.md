# Gathera Smart Contract Suite

A comprehensive smart contract ecosystem for the Gathera platform, providing secure and efficient solutions for event ticketing, escrow services, and multi-signature wallet management.

## Overview

The Gathera contract suite is organized into logical modules with clear boundaries and well-defined interfaces:

```
contract/
├── common/                    # Shared utilities and types
├── ticket_contract/          # Soulbound ticket system
├── escrow_contract/         # Secure escrow services
├── multisig_wallet_contract/ # Multi-signature wallet
├── contracts/               # Integration layer
└── test/                    # Testing utilities
```

## Modules

### 📦 `gathera-common`

**Purpose**: Provides shared utilities, types, and testing frameworks used across all contracts.

**Key Features**:
- Gas measurement and benchmarking utilities
- Common data types and structures
- Error handling patterns
- Testing frameworks

**Dependencies**: None (base module)

### 🎫 `ticket_contract`

**Purpose**: Implements soulbound (non-transferable) ticket system for events and activities.

**Key Features**:
- Soulbound ticket mechanism
- Event-based ticket issuance
- Attendance tracking and verification
- Integration with escrow for payments

**Dependencies**: `gathera-common`

### 🔒 `escrow_contract`

**Purpose**: Provides secure escrow services with conditional release and dispute resolution.

**Key Features**:
- Secure fund escrow with multi-sig support
- Conditional release mechanisms
- Dispute resolution system
- Time-based auto-release

**Dependencies**: `gathera-common`

### 👥 `multisig_wallet_contract`

**Purpose**: Implements multi-signature wallet for enhanced security of organizational funds.

**Key Features**:
- Multi-signature transaction approval
- Configurable threshold settings
- Owner management with voting
- Time-lock for critical operations

**Dependencies**: `gathera-common`

### 🔗 `contracts` (Integration Layer)

**Purpose**: Provides orchestration and unified interfaces for cross-contract operations.

**Key Features**:
- Cross-contract workflow management
- Unified client interfaces
- Contract deployment utilities
- Common business workflows

**Dependencies**: All other contracts

### 🧪 `test`

**Purpose**: Comprehensive testing utilities and benchmarks for the entire suite.

**Key Features**:
- Gas benchmarking and regression testing
- Integration testing frameworks
- Performance monitoring
- Edge case testing

**Dependencies**: All contracts

## Architecture Principles

### 1. **Clear Module Boundaries**
Each contract has a single responsibility and well-defined interface.

### 2. **Minimal Dependencies**
Dependencies flow in one direction to avoid circular dependencies:
```
common → ticket_contract
common → escrow_contract  
common → multisig_wallet_contract
all contracts → contracts (integration)
all contracts → test
```

### 3. **Shared Utilities**
Common functionality is centralized in `gathera-common` to reduce duplication.

### 4. **Comprehensive Testing**
Each module includes extensive tests with shared testing utilities.

## Development Workflow

### Building All Contracts
```bash
cargo build --workspace --release
```

### Running Tests
```bash
cargo test --workspace
```

### Running Gas Benchmarks
```bash
cargo test --package gathera-test --release -- --ignored
```

### Contract Deployment
Use the deployment utilities in the `contracts` module for automated deployment.

## Gas Optimization

All contracts are optimized for minimal gas usage:

- **Profile**: Optimized for size (`opt-level = "z"`)
- **Link-Time Optimization**: Enabled for better optimization
- **Strip Symbols**: Reduces contract size
- **Single Codegen Unit**: Maximizes optimization opportunities

## Security Features

### 1. **Access Control**
Role-based access control with proper authorization checks.

### 2. **Input Validation**
Comprehensive input validation to prevent vulnerabilities.

### 3. **Reentrancy Protection**
Built-in protection against reentrancy attacks.

### 4. **Overflow Protection**
Automatic overflow checks in all arithmetic operations.

## Integration Patterns

### Event Ticketing Workflow
```
Event Creation → Ticket Issuance → Escrow Payment → Attendance Verification
```

### Multi-Sig Operations
```
Transaction Submission → Owner Approvals → Threshold Check → Execution
```

### Dispute Resolution
```
Dispute Creation → Evidence Collection → Resolution Voting → Fund Distribution
```

## Testing Strategy

### Unit Tests
Each contract has comprehensive unit tests covering all functionality.

### Integration Tests
Cross-contract workflows are tested end-to-end.

### Gas Benchmarks
Regular gas usage monitoring to ensure efficiency.

### Security Tests
Extensive security testing including edge cases and attack vectors.

## Contributing

When contributing to the Gathera contract suite:

1. **Follow Module Boundaries**: Keep changes within the intended module scope
2. **Update Documentation**: Document any new features or changes
3. **Add Tests**: Ensure comprehensive test coverage
4. **Check Gas Usage**: Verify gas efficiency of changes
5. **Run CI**: Ensure all tests pass before submitting

## License

This project is licensed under the MIT License - see the LICENSE file for details.
