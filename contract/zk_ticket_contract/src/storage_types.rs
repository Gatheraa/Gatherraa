use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    ZKProof(BytesN<32>),
    Nullifier(BytesN<32>),
    TicketCommitment(BytesN<32>),
    EventCommitments(Address),
    UserProofs(Address),
    VerificationCache,
    CircuitParams,
    RevocationList,
    RevokedCommitment(BytesN<32>), // Efficient revocation check
    BatchVerification,
}

#[derive(Clone)]
#[contracttype]
pub struct ZKProof {
    pub proof_id: BytesN<32>,
    pub ticket_commitment: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub event_id: Address,
    pub owner: Address,
    pub attributes: Vec<ZKAttribute>,
    pub proof_data: Vec<u8>,
    pub verification_hash: BytesN<32>,
    pub created_at: u64,
    pub verified_at: Option<u64>,
    pub expires_at: u64,
    pub revoked: bool,
    pub batch_id: Option<BytesN<32>>,
}

#[derive(Clone)]
#[contracttype]
pub struct ZKAttribute {
    pub attribute_type: AttributeType,
    pub value: Vec<u8>,
    pub revealed: bool,
    pub commitment: BytesN<32>,
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum AttributeType {
    TicketId,
    EventId,
    OwnerIdentity,
    PurchaseDate,
    SeatNumber,
    TicketType,
    Price,
    ValidUntil,
    Custom(Symbol),
}

#[derive(Clone)]
#[contracttype]
pub struct TicketCommitment {
    pub commitment: BytesN<32>,
    pub event_id: Address,
    pub ticket_hash: BytesN<32>,
    pub created_at: u64,
    pub nullifier: BytesN<32>,
    pub attributes_hash: BytesN<32>,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct NullifierInfo {
    pub nullifier: BytesN<32>,
    pub used: bool,
    pub used_at: Option<u64>,
    pub proof_id: Option<BytesN<32>>,
}

#[derive(Clone)]
#[contracttype]
pub struct EventCommitments {
    pub event_id: Address,
    pub commitments: Vec<BytesN<32>>,
    pub total_tickets: u32,
    pub active_tickets: u32,
    pub created_at: u64,
    pub circuit_params: CircuitParameters,
}

#[derive(Clone)]
#[contracttype]
pub struct CircuitParameters {
    pub circuit_hash: BytesN<32>,
    pub proving_key_hash: BytesN<32>,
    pub verification_key_hash: BytesN<32>,
    pub attribute_count: u32,
    pub public_inputs: u32,
    pub private_inputs: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationCache {
    pub cache_key: BytesN<32>,
    pub result: bool,
    pub timestamp: u64,
    pub proof_id: BytesN<32>,
}

#[derive(Clone)]
#[contracttype]
pub struct RevocationList {
    pub revoked_commitments: Vec<BytesN<32>>,
    pub revoked_nullifiers: Vec<BytesN<32>>,
    pub last_updated: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct BatchVerification {
    pub batch_id: BytesN<32>,
    pub proofs: Vec<BytesN<32>>,
    pub results: Vec<bool>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub status: BatchStatus,
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum BatchStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Clone)]
#[contracttype]
pub struct MobileProofData {
    pub mobile_device_id: BytesN<32>,
    pub proof_template: Vec<u8>,
    pub last_used: u64,
    pub usage_count: u32,
}

// Custom errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ZKTicketError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ProofNotFound = 4,
    InvalidProof = 5,
    ProofExpired = 6,
    NullifierAlreadyUsed = 7,
    InvalidCommitment = 8,
    TicketRevoked = 9,
    VerificationFailed = 10,
    InvalidAttribute = 11,
    InvalidCircuitParams = 12,
    BatchNotFound = 13,
    BatchProcessing = 14,
    MobileVerificationFailed = 15,
    InvalidSignature = 16,
    AttributeNotRevealed = 17,
    DuplicateCommitment = 18,
    InvalidEventId = 19,
    InsufficientAttributes = 20,
    ProofTooLarge = 21,
    CircuitMismatch = 22,
    RevocationFailed = 23,
    CacheExpired = 24,
    BatchSizeExceeded = 25,
    InvalidNullifier = 26,
    InvalidTimestamp = 27,
    ContractPaused = 28,
}
