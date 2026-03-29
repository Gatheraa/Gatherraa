# ADR-002: Soroban Storage Strategy

- **Status**: Accepted
- **Created**: March 29, 2026
- **Context**: On Stellar Soroban, data must be stored in one of three ways: Temporary, Persistent, or Instance. Choosing the wrong one can lead to excessive fees or data loss.
- **Decision**: We have established the following rules for Gathera contracts:
  1.  **Instance Storage**: Used for contract configuration, protocol fees, and owner addresses.
  2.  **Persistent Storage**: Used for critical user data like ticket ownership, escrow balances, and multisig proposal logs.
  3.  **Temporary Storage**: Used for non-critical, short-lived data like temporary auction bid hashes or short-term voter proofs.
- **Consequences**:
  - **Reliability**: Important data is protected and won't be deleted after expiry.
  - **Efficiency**: Proper use of Temporary storage saves on rents for short-term operations.
  - **Archiving**: Older data in Persistent storage may require manual eviction if the volume becomes too large for efficient contract performance.
