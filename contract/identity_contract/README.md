# Identity Contract Documentation

## Overview
The Identity Registry Contract is a decentralized identity management system built on Stellar using Soroban smart contracts. It provides a W3C DID (Decentralized Identifier) compliant identity registry that allows users to create and manage Web3 identities, link social profiles, verify credentials, and build reputation scores for event participation.

## Features

### Core Identity Management
- **DID Creation**: Users can create Decentralized Identifiers (DIDs) tied to their Stellar addresses
- **DID Resolution**: Resolve DIDs to retrieve complete identity documents
- **DID Deactivation**: Users can deactivate their DIDs when no longer needed

### Claim Management
- **Multi-claim Support**: Add various claim types (Twitter, GitHub, email, Discord, etc.)
- **Cryptographic Proofs**: Each claim includes cryptographic proof for verification
- **Oracle Verification**: Claims can be verified by trusted oracles
- **Selective Disclosure**: Privacy-preserving claim sharing
- **Revocation Mechanism**: Compromised credentials can be revoked

### Reputation System
- **Base Reputation Score**: All DIDs start with a base reputation score
- **Event Attendance**: Reputation increases with verified event participation
- **Verified Credentials**: Additional reputation for verified social profiles
- **Dynamic Scoring**: Reputation scores update based on activities

### Delegation System
- **Permission-based Delegation**: Grant specific permissions to trusted addresses
- **Time-limited Delegations**: Delegations can have expiration times
- **Granular Permissions**: Fine-grained control over what delegates can do
- **Revocable Delegations**: Delegations can be revoked at any time

### Security Features
- **Claim Revocation**: Immediate revocation of compromised credentials
- **Delegation Revocation**: Revoke delegate permissions when needed
- **Contract Pause**: Admin can pause contract during emergencies
- **Permission Validation**: Strict permission checking for all operations

## Contract Interface

### Initialization
```rust
fn initialize(e: Env, admin: Address)
```
Initialize the contract with an admin address.

### DID Management
```rust
fn create_did(e: Env, user: Address, public_key: BytesN<32>) -> String
fn resolve_did(e: Env, did: String) -> DIDDocument
fn deactivate_did(e: Env, did: String)
fn get_did_by_address(e: Env, address: Address) -> Option<String>
```

### Claim Management
```rust
fn add_claim(e: Env, did: String, claim_type: String, claim_value: String, proof: Bytes) -> u32
fn verify_claim(e: Env, did: String, claim_id: u32, oracle_signature: Bytes)
fn revoke_claim(e: Env, did: String, claim_id: u32, reason: String)
fn is_claim_verified(e: Env, did: String, claim_id: u32) -> bool
fn get_verified_claims_by_type(e: Env, did: String, claim_type: String) -> Vec<Claim>
```

### Reputation System
```rust
fn add_event_attendance(e: Env, did: String, event_id: String, score: u32)
fn get_reputation_score(e: Env, did: String) -> u32
```

### Delegation System
```rust
fn add_delegation(e: Env, did: String, delegate: Address, permissions: Vec<String>, expiry: u64)
fn revoke_delegation(e: Env, did: String, delegate: Address)
```

### Admin Functions
```rust
fn pause(e: Env)
fn unpause(e: Env)
fn get_total_dids(e: Env) -> u32
```

## Data Structures

### DIDDocument
```rust
struct DIDDocument {
    id: String,              // DID identifier (did:stellar:<hash>)
    controller: Address,     // Stellar address controlling this DID
    public_key: BytesN<32>,  // Public key for cryptographic operations
    created: u64,            // Creation timestamp
    updated: u64,            // Last update timestamp
    deactivated: bool,       // Deactivation status
    claims: Vec<Claim>,      // List of claims
    reputation_score: u32,   // Reputation score
}
```

### Claim
```rust
struct Claim {
    id: u32,                 // Unique claim identifier
    claim_type: String,      // Type (twitter, github, email, etc.)
    claim_value: String,     // Claim value (handle, email address)
    issuer: Address,         // Who issued the claim
    issued_at: u64,          // Issuance timestamp
    verified: bool,          // Oracle verification status
    proof: Bytes,            // Cryptographic proof
    revoked: bool,           // Revocation status
}
```

### Delegation
```rust
struct Delegation {
    delegate: Address,       // Address being delegated to
    permissions: Vec<String>, // Granted permissions
    created_at: u64,         // Creation timestamp
    expiry: u64,             // Expiration timestamp
    revoked: bool,           // Revocation status
}
```

## DID Resolution Process

1. **DID Format**: `did:stellar:<sha256_hash_of_address>`
2. **Resolution**: Query the contract with the DID string
3. **Response**: Returns complete DIDDocument with all claims and metadata
4. **Verification**: Check claim verification status and revocation status

## Claim Types Supported

- `twitter` - Twitter handle verification
- `github` - GitHub username verification
- `email` - Email address verification
- `discord` - Discord username verification
- `telegram` - Telegram username verification
- `website` - Personal website verification
- Custom claim types can be added as needed

## Reputation Scoring System

| Activity | Points |
|----------|--------|
| Base DID Creation | 100 |
| Verified Credential | +30 |
| Event Attendance | +50 (max per event) |
| Community Contribution | Variable |

## Privacy Features

- **Selective Disclosure**: Users can choose which claims to share
- **Claim Revocation**: Immediate invalidation of compromised credentials
- **Delegation Control**: Fine-grained permission management
- **No Personal Data Storage**: Only cryptographic proofs and hashes stored

## Oracle Integration

The contract supports off-chain oracle verification for claims:
1. User submits claim with cryptographic proof
2. Oracle verifies the claim off-chain
3. Oracle signs verification result
4. Contract validates oracle signature and updates claim status

## Error Handling

The contract includes comprehensive error handling:
- `already initialized` - Contract already initialized
- `DID already exists` - Address already has a DID
- `Maximum claims limit reached` - Too many claims (50 max)
- `Claim not found` - Specified claim ID doesn't exist
- `Claim already verified` - Cannot verify twice
- `Permission not granted` - Insufficient delegation permissions
- `contract is paused` - Contract currently paused

## Testing

The contract includes comprehensive unit tests covering:
- DID creation and resolution
- Claim management (add, verify, revoke)
- Delegation system
- Reputation scoring
- Error conditions
- Edge cases

Run tests with:
```bash
cd contract/identity_contract
cargo test
```

## Deployment

1. Build the contract:
```bash
cd contract/identity_contract
cargo build --target wasm32-unknown-unknown --release
```

2. Deploy using Stellar CLI or Soroban tools

3. Initialize with admin address

## Integration with Event System

This identity contract is designed to integrate with your existing event system:
- Event organizers can verify attendee identities
- Reputation scores can determine event access tiers
- Verified credentials can provide special access
- Delegation allows team members to manage event identities

## Security Considerations

- All operations require proper authentication
- Delegations have time limits and can be revoked
- Claims can be immediately revoked if compromised
- Oracle signatures are cryptographically verified
- Contract can be paused in emergencies