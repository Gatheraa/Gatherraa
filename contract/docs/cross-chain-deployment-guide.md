# Cross-Chain Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Gatheraa cross-chain staking contracts across multiple blockchain networks. The implementation supports Ethereum, Polygon, Arbitrum, Optimism, Base, and Stellar networks.

## Prerequisites

### Development Environment
- Node.js >= 18.0.0
- Rust >= 1.70.0
- Hardhat >= 3.1.0
- Soroban CLI tools

### Required Dependencies
```bash
# Install Node.js dependencies
npm install

# Install Rust dependencies
cargo build --release
```

### Environment Configuration
Copy the environment template and configure your settings:
```bash
cp .env.example .env
```

Update the `.env` file with your actual RPC URLs and private keys.

## Architecture Overview

### Contract Components
1. **CrossChainStakingContract**: Main staking contract with cross-chain capabilities
2. **ChainAbstraction**: Chain abstraction layer for multi-chain operations
3. **Storage Layer**: Optimized storage with cross-chain support
4. **Types**: Cross-chain data structures and configurations

### Supported Networks
| Network | Chain ID | Block Time | Gas Limit | Confirmations |
|---------|-----------|------------|-----------|---------------|
| Ethereum | 1 | 12s | 300,000 | 12 |
| Polygon | 137 | 2s | 200,000 | 5 |
| Arbitrum | 42161 | 1s | 250,000 | 8 |
| Optimism | 10 | 2s | 200,000 | 6 |
| Base | 8453 | 2s | 200,000 | 6 |
| Stellar | 2 | 5s | 100,000 | 3 |

## Deployment Process

### 1. Local Development Deployment

Deploy to local Hardhat networks for testing:
```bash
# Deploy to all local networks
npm run deploy-cross-chain

# Deploy to specific local network
npm run deploy:local

# Test cross-chain functionality locally
npm run test:local
```

### 2. Testnet Deployment

Deploy to Sepolia testnets:
```bash
# Deploy to all testnets
npm run deploy:testnet

# Test cross-chain functionality on testnets
npm run test:testnet
```

### 3. Mainnet Deployment

⚠️ **WARNING**: Mainnet deployment requires careful preparation and testing.

#### Pre-deployment Checklist:
- [ ] All tests pass on local and testnet environments
- [ ] Security audit completed
- [ ] Bridge contracts verified and funded
- [ ] Sufficient gas funds for deployment
- [ ] Monitoring systems in place
- [ ] Emergency procedures documented

#### Deployment Steps:
```bash
# Deploy to Ethereum mainnet
npx hardhat run scripts/deploy-cross-chain.ts --network mainnet

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy-cross-chain.ts --network polygon

# Deploy to Arbitrum mainnet
npx hardhat run scripts/deploy-cross-chain.ts --network arbitrum

# Deploy to Optimism mainnet
npx hardhat run scripts/deploy-cross-chain.ts --network optimism

# Deploy to Base mainnet
npx hardhat run scripts/deploy-cross-chain.ts --network base
```

## Configuration Management

### Chain Configuration
The `config/chains.json` file contains all chain-specific configurations:

```json
{
  "networks": {
    "ethereum": {
      "chainId": 1,
      "rpcUrl": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
      "blockTime": 12,
      "gasLimit": 300000,
      "confirmations": 12,
      "bridge": {
        "address": "0x...",
        "minConfirmations": 2,
        "maxGasLimit": 500000
      }
    }
  }
}
```

### Environment Variables
Key environment variables for cross-chain operations:

```bash
# Network-specific RPC URLs
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_RPC_URL=https://polygon-rpc.com
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
BASE_RPC_URL=https://mainnet.base.org

# Bridge addresses
ETHEREUM_BRIDGE_ADDRESS=0x1234567890123456789012345678901234567890
POLYGON_BRIDGE_ADDRESS=0x2345678901234567890123456789012345678901

# Cross-chain settings
CROSS_CHAIN_ENABLED=true
CROSS_CHAIN_TIMEOUT=3600000
CROSS_CHAIN_RETRY_ATTEMPTS=3
```

## Cross-Chain Operations

### Supported Operations
1. **Cross-Chain Staking**: Stake tokens on one chain, earn rewards on another
2. **Cross-Chain Unstaking**: Unstake tokens across chains
3. **Cross-Chain Reward Claims**: Claim rewards on any supported chain
4. **Chain Migration**: Move positions between chains

### Operation Flow
1. User initiates operation on source chain
2. Contract validates chain compatibility
3. Tokens are locked on source chain
4. Cross-chain message is created and signed
5. Bridge protocol transfers message to target chain
6. Target chain contract validates and executes operation
7. Status is updated across all chains

### Gas Estimation
Use the chain abstraction to estimate costs:
```javascript
// Estimate cross-chain cost
const cost = await chainAbstraction.estimate_cross_chain_cost(
  sourceChainId,
  targetChainId,
  amount
);
```

## Bridge Integration

### Supported Bridges
- **LayerZero**: For EVM chain interoperability
- **Hyperlane**: For sovereign cross-chain messaging
- **Wormhole**: For EVM and non-EVM chain support
- **Custom Bridges**: Protocol-specific implementations

### Bridge Configuration
Configure bridge settings in the chain configuration:

```json
{
  "bridge": {
    "address": "0x1234567890123456789012345678901234567890",
    "protocol": "layerzero",
    "minConfirmations": 2,
    "maxGasLimit": 500000,
    "enabled": true
  }
}
```

### Bridge Security
- Multi-signature validation
- Confirmation requirements
- Amount limits
- Blacklist/whitelist support
- Timelock protection

## Testing Strategy

### Unit Tests
```bash
# Run Rust unit tests
cargo test

# Run TypeScript unit tests
npm test
```

### Integration Tests
```bash
# Test cross-chain functionality
npm run test-cross-chain

# Test specific network pairs
npm run test:local
npm run test:testnet
```

### Test Coverage
- Chain compatibility validation
- Gas price estimation
- Amount conversion
- Address validation
- Bridge integration
- Error handling

## Monitoring and Maintenance

### Cross-Chain Monitoring
Monitor the following metrics:
- Cross-chain transaction volume
- Bridge health status
- Gas usage patterns
- Error rates
- Confirmation times

### Alerting
Set up alerts for:
- Bridge failures
- High gas prices
- Unusual transaction patterns
- Security events

### Maintenance Tasks
- Regular bridge health checks
- Gas limit adjustments
- Configuration updates
- Security patches

## Security Considerations

### Smart Contract Security
- Reentrancy protection
- Access control mechanisms
- Input validation
- Emergency pause functionality
- Upgrade patterns

### Cross-Chain Security
- Bridge contract verification
- Message authenticity validation
- Replay attack prevention
- Amount limits and controls
- Multi-signature requirements

### Operational Security
- Private key management
- RPC endpoint security
- Network monitoring
- Incident response procedures

## Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check gas limits
npx hardhat run scripts/check-gas-limits.ts

# Verify network connectivity
npx hardhat run scripts/test-connectivity.ts
```

#### Cross-Chain Failures
```bash
# Check bridge status
npx hardhat run scripts/check-bridge-health.ts

# Validate chain compatibility
npx hardhat run scripts/validate-chains.ts
```

#### Gas Estimation Errors
```bash
# Update gas limits
npx hardhat run scripts/update-gas-limits.ts

# Check gas prices
npx hardhat run scripts/check-gas-prices.ts
```

### Debug Mode
Enable debug logging:
```bash
DEBUG=true npm run test-cross-chain
```

## Performance Optimization

### Gas Optimization
- Batch operations where possible
- Optimize storage layouts
- Use efficient data structures
- Minimize cross-chain calls

### Latency Optimization
- Choose optimal bridge protocols
- Configure appropriate confirmation counts
- Implement caching strategies
- Use parallel processing

## Upgrade Procedures

### Contract Upgrades
1. Deploy new contracts
2. Initialize with existing state
3. Migrate liquidity and positions
4. Update bridge configurations
5. Test thoroughly
6. Switch to new contracts

### Configuration Updates
1. Update chain configurations
2. Test with small amounts
3. Monitor for issues
4. Roll out gradually

## Emergency Procedures

### Emergency Pause
```javascript
// Pause cross-chain operations
await stakingContract.pauseCrossChain();
```

### Emergency Withdraw
```javascript
// Emergency withdrawal for users
await stakingContract.emergencyWithdraw(user, amount);
```

### Bridge Failure Recovery
1. Identify failed transactions
2. Attempt manual recovery
3. Contact bridge providers
4. Consider alternative bridges

## Best Practices

### Development
- Test thoroughly on testnets
- Use deterministic deployment
- Implement comprehensive logging
- Follow security checklists

### Deployment
- Use multi-signature wallets
- Deploy gradually
- Monitor closely after deployment
- Have rollback plans ready

### Operations
- Regular security audits
- Continuous monitoring
- Performance optimization
- User education

## Support

### Documentation
- [API Reference](./docs/api-reference.md)
- [Architecture Guide](./docs/architecture.md)
- [Security Guide](./docs/security.md)

### Community
- [GitHub Issues](https://github.com/Ardecrownn/Gatherraa/issues)
- [Discord Community](https://discord.gg/gatheraa)
- [Telegram Channel](https://t.me/gatheraa)

### Contact
- Technical Support: support@gatheraa.com
- Security Issues: security@gatheraa.com
- Business Inquiries: business@gatheraa.com

---

*Last Updated: March 28, 2026*
*Version: 1.0.0*
