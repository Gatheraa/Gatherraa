use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
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
    BatchVerification,
}

#[derive(Clone)]
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
pub struct ZKAttribute {
    pub attribute_type: AttributeType,
    pub value: Vec<u8>,
    pub revealed: bool,
    pub commitment: BytesN<32>,
}

#[derive(Clone, PartialEq)]
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
pub struct NullifierInfo {
    pub nullifier: BytesN<32>,
    pub used: bool,
    pub used_at: Option<u64>,
    pub proof_id: Option<BytesN<32>>,
}

#[derive(Clone)]
pub struct EventCommitments {
    pub event_id: Address,
    pub commitments: Vec<BytesN<32>>,
    pub total_tickets: u32,
    pub active_tickets: u32,
    pub created_at: u64,
    pub circuit_params: CircuitParameters,
}

#[derive(Clone)]
pub struct CircuitParameters {
    pub circuit_hash: BytesN<32>,
    pub proving_key_hash: BytesN<32>,
    pub verification_key_hash: BytesN<32>,
    pub attribute_count: u32,
    pub public_inputs: u32,
    pub private_inputs: u32,
}

#[derive(Clone)]
pub struct VerificationCache {
    pub cache_key: BytesN<32>,
    pub result: bool,
    pub timestamp: u64,
    pub proof_id: BytesN<32>,
}

#[derive(Clone)]
pub struct RevocationList {
    pub revoked_commitments: Vec<BytesN<32>>,
    pub revoked_nullifiers: Vec<BytesN<32>>,
    pub last_updated: u64,
}

#[derive(Clone)]
pub struct BatchVerification {
    pub batch_id: BytesN<32>,
    pub proofs: Vec<BytesN<32>>,
    pub results: Vec<bool>,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub status: BatchStatus,
}

#[derive(Clone, PartialEq)]
pub enum BatchStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Clone)]
pub struct MobileProofData {
    pub mobile_device_id: BytesN<32>,
    pub proof_template: Vec<u8>,
    pub last_used: u64,
    pub usage_count: u32,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum ZKTicketError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    ProofNotFound,
    InvalidProof,
    ProofExpired,
    NullifierAlreadyUsed,
    InvalidCommitment,
    TicketRevoked,
    VerificationFailed,
    InvalidAttribute,
    InvalidCircuitParams,
    BatchNotFound,
    BatchProcessing,
    MobileVerificationFailed,
    InvalidSignature,
    AttributeNotRevealed,
    DuplicateCommitment,
    InvalidEventId,
    InsufficientAttributes,
    ProofTooLarge,
    CircuitMismatch,
    RevocationFailed,
    CacheExpired,
    BatchSizeExceeded,
    InvalidNullifier,
    InvalidTimestamp,
    ContractPaused,
}
