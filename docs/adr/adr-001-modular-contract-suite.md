# ADR-001: Modular Contract Suite

- **Status**: Accepted
- **Created**: March 29, 2026
- **Context**: The Gathera protocol needs to manage complex workflows like ticketing, payments, and multisig. A single monolithic contract would be difficult to test, maintain, and could exceed Soroban WASM size limits.
- **Decision**: We have decided to split the protocol into several independent but interoperable contracts:
  1.  `ticket_contract`: Soulbound NFT ticketing.
  2.  `escrow_contract`: Payment and split handling.
  3.  `multisig_wallet_contract`: High-security fund management.
  4.  `dutch_auction_contract`: Fair ticket price discovery.
  5.  `zk_ticket_contract`: Privacy-preserving verification.
  6.  `cross_contract_contract`: Orchestration layer.
- **Consequences**:
  - **Improved Testing**: Sub-contracts can be unit-tested in isolation.
  - **Gas Efficiency**: Users only interact with the WASM they need.
  - **Upgradeability**: Individual modules can be redeployed and linked without migration of all state.
  - **Complexity**: Managing multi-contract interactions requires careful design of cross-contract calls and error handling.
