use soroban_sdk::{contracttype, Address, Bytes, String, Vec, BytesN, Symbol};
use gathera_common::types::{Timestamp, ReputationScore, ClaimId};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                                    // Address of contract admin
    Paused,                                   // bool - contract pause status
    TotalDIDs,                                // u32 - total number of DIDs created
    NextClaimId,                              // u32 - auto-incrementing claim ID
    DID(String),                              // DIDDocument - store DID documents
    AddressToDID(Address),                    // String - map Address to DID
    Delegation(String, Address),              // Delegation - delegations for a DID
    Revocation(String, u32),                  // Revocation - revoked claims
    EventAttendance(String, String),          // u64 - event attendance timestamps
    Role(Symbol, Address),                    // Role management
}

#[derive(Clone)]
#[contracttype]
pub struct DIDDocument {
    pub id: String,                           // DID identifier
    pub controller: Address,                  // Stellar address controlling this DID
    pub public_key: BytesN<32>,              // Public key for cryptographic operations
    pub created: Timestamp,                         // Timestamp when created
    pub updated: Timestamp,                         // Timestamp when last updated
    pub deactivated: bool,                    // Whether DID is deactivated
    pub claims: Vec<Claim>,                   // List of claims
    pub reputation_score: ReputationScore,                // Reputation score
}

#[derive(Clone)]
#[contracttype]
pub struct Claim {
    pub id: ClaimId,                              // Unique claim identifier
    pub claim_type: String,                   // Type of claim (Twitter, GitHub, email, etc.)
    pub claim_value: String,                  // Claim value (handle, email address, etc.)
    pub issuer: Address,                      // Who issued this claim
    pub issued_at: Timestamp,                       // When claim was issued
    pub verified: bool,                       // Whether claim is verified by oracle
    pub proof: Bytes,                         // Cryptographic proof of claim
    pub revoked: bool,                        // Whether claim is revoked
}

#[derive(Clone)]
#[contracttype]
pub struct Credential {
    pub id: String,                           // Credential identifier
    pub did: String,                          // DID this credential belongs to
    pub credential_type: String,              // Type of credential
    pub issuer: String,                       // Issuer DID
    pub issued_at: Timestamp,                       // Issuance timestamp
    pub expires_at: Timestamp,                      // Expiration timestamp
    pub credential_data: Bytes,               // Encrypted credential data
    pub verified: bool,                       // Verification status
    pub revoked: bool,                        // Revocation status
}

#[derive(Clone)]
#[contracttype]
pub struct Delegation {
    pub delegate: Address,                    // Address being delegated to
    pub permissions: Vec<String>,             // List of permissions granted
    pub created_at: Timestamp,                      // When delegation was created
    pub expiry: Timestamp,                          // When delegation expires
    pub revoked: bool,                        // Whether delegation is revoked
}

#[derive(Clone)]
#[contracttype]
pub struct Revocation {
    pub claim_id: ClaimId,                        // ID of revoked claim
    pub revoked_at: Timestamp,                      // When claim was revoked
    pub revoked_by: Address,                  // Who revoked the claim
    pub reason: String,                       // Reason for revocation
}