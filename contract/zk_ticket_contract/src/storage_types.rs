use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256};

/// Storage keys for the ZK Ticket Contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The administrator address.
    Admin,
    /// Boolean flag indicating if the contract is paused.
    Paused,
    /// Current logic version of the contract.
    Version,
    /// Storage key for a specific ZK Proof: [BytesN<32>].
    ZKProof(BytesN<32>),
    /// Storage key for a nullifier to prevent double-spending: [BytesN<32>].
    Nullifier(BytesN<32>),
    /// Storage key for a ticket commitment: [BytesN<32>].
    TicketCommitment(BytesN<32>),
    /// Storage key for all commitments associated with an event: [Address].
    EventCommitments(Address),
    /// Storage key for all proof IDs submitted by a user: [Address].
    UserProofs(Address),
    /// Cache for recent verification results.
    VerificationCache,
    /// Global circuit parameters used for verification.
    CircuitParams,
    /// The list of revoked ticket commitments and nullifiers.
    RevocationList,
    RevokedCommitment(BytesN<32>), // Efficient revocation check
    BatchVerification,
}

/// Represents a validated Zero-Knowledge proof for a ticket.
#[derive(Clone)]
#[contracttype]
pub struct ZKProof {
    /// Unique identifier for this proof.
    pub proof_id: BytesN<32>,
    /// The commitment of the ticket being proven.
    pub ticket_commitment: BytesN<32>,
    /// Secure nullifier to prevent re-use of the same ticket.
    pub nullifier: BytesN<32>,
    /// The address of the event contract.
    pub event_id: Address,
    /// The address of the ticket owner.
    pub owner: Address,
    /// List of attributes (some potentially revealed).
    pub attributes: Vec<ZKAttribute>,
    /// The raw ZK proof data.
    pub proof_data: Vec<u8>,
    /// Hash of the verification parameters for integrity.
    pub verification_hash: BytesN<32>,
    /// Timestamp when the proof was submitted.
    pub created_at: u64,
    /// Timestamp when verification was completed.
    pub verified_at: Option<u64>,
    /// Expiration timestamp for this proof.
    pub expires_at: u64,
    /// Flag indicating if the proof has been revoked.
    pub revoked: bool,
    /// ID of the batch this proof was verified in, if any.
    pub batch_id: Option<BytesN<32>>,
}

/// An attribute associated with a ZK ticket (e.g., Seat Number, Price).
#[derive(Clone)]
#[contracttype]
pub struct ZKAttribute {
    /// The type of the attribute.
    pub attribute_type: AttributeType,
    /// The actual value (only meaningful if `revealed` is true).
    pub value: Vec<u8>,
    /// Whether the value is publicly revealed or remains hidden in ZK.
    pub revealed: bool,
    /// The cryptographic commitment to this attribute's value.
    pub commitment: BytesN<32>,
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum AttributeType {
    /// Unique ticket ID.
    TicketId,
    /// Associated event ID.
    EventId,
    /// Identity of the owner.
    OwnerIdentity,
    /// Date of purchase.
    PurchaseDate,
    /// Assigned seat number.
    SeatNumber,
    /// Type of ticket (e.g., VIP, General).
    TicketType,
    /// Purchase price.
    Price,
    /// Validity period end.
    ValidUntil,
    /// Any other custom attribute type.
    Custom(Symbol),
}

/// Cryptographic commitment to a ticket and its attributes.
#[derive(Clone)]
#[contracttype]
pub struct TicketCommitment {
    /// The unique commitment hash.
    pub commitment: BytesN<32>,
    /// The event this ticket belongs to.
    pub event_id: Address,
    /// Hash of the base ticket data.
    pub ticket_hash: BytesN<32>,
    /// Creation timestamp.
    pub created_at: u64,
    /// The nullifier that will be revealed upon use.
    pub nullifier: BytesN<32>,
    /// Combined hash of all attribute commitments.
    pub attributes_hash: BytesN<32>,
    /// Whether the commitment is currently valid.
    pub active: bool,
}

/// Tracks the usage status of a nullifier to prevent double-spending.
#[derive(Clone)]
#[contracttype]
pub struct NullifierInfo {
    /// The nullifier hash.
    pub nullifier: BytesN<32>,
    /// Whether this nullifier has been used (revealed).
    pub used: bool,
    /// When the nullifier was used.
    pub used_at: Option<u64>,
    /// The proof ID that revealed this nullifier.
    pub proof_id: Option<BytesN<32>>,
}

/// Collection of commitments belonging to a specific event.
#[derive(Clone)]
#[contracttype]
pub struct EventCommitments {
    /// The event address.
    pub event_id: Address,
    /// List of all ticket commitments for this event.
    pub commitments: Vec<BytesN<32>>,
    /// Total number of tickets created.
    pub total_tickets: u32,
    /// Number of tickets currently active.
    pub active_tickets: u32,
    /// Registration timestamp.
    pub created_at: u64,
    /// Circuit parameters specifically for this event's tickets.
    pub circuit_params: CircuitParameters,
}

/// Cryptographic parameters for the ZK circuit.
#[derive(Clone)]
#[contracttype]
pub struct CircuitParameters {
    /// Hash of the circuit definition.
    pub circuit_hash: BytesN<32>,
    /// Hash of the proving key.
    pub proving_key_hash: BytesN<32>,
    /// Hash of the verification key.
    pub verification_key_hash: BytesN<32>,
    /// Expected number of attributes in tickets.
    pub attribute_count: u32,
    /// Number of public inputs in the ZK proof.
    pub public_inputs: u32,
    /// Number of private inputs in the ZK proof.
    pub private_inputs: u32,
}

/// Cached result of a ZK proof verification.
#[derive(Clone)]
#[contracttype]
pub struct VerificationCache {
    /// Unique key for the cached item.
    pub cache_key: BytesN<32>,
    /// Result of the verification (true = valid).
    pub result: bool,
    /// Timestamp when the result was cached.
    pub timestamp: u64,
    /// ID of the proof being cached.
    pub proof_id: BytesN<32>,
}

/// List of revoked commitments and nullifiers.
#[derive(Clone)]
#[contracttype]
pub struct RevocationList {
    /// Commitments that have been manually revoked.
    pub revoked_commitments: Vec<BytesN<32>>,
    /// Nullifiers associated with revoked tickets.
    pub revoked_nullifiers: Vec<BytesN<32>>,
    /// Last update timestamp.
    pub last_updated: u64,
}

/// Status and data for a batch verification operation.
#[derive(Clone)]
#[contracttype]
pub struct BatchVerification {
    /// Unique ID for the batch.
    pub batch_id: BytesN<32>,
    /// List of proof IDs in this batch.
    pub proofs: Vec<BytesN<32>>,
    /// Parallel list of verification results.
    pub results: Vec<bool>,
    /// Initiation timestamp.
    pub created_at: u64,
    /// Completion timestamp.
    pub completed_at: Option<u64>,
    /// Current status of the batch.
    pub status: BatchStatus,
}

#[derive(Clone, Copy, PartialEq)]
#[contracttype]
pub enum BatchStatus {
    /// Batch is waiting for processing.
    Pending,
    /// Batch is currently being verified.
    Processing,
    /// All proofs in the batch have been processed.
    Completed,
    /// An error occurred during batch processing.
    Failed,
}

/// Tracking data for simplified mobile device proofs.
#[derive(Clone)]
#[contracttype]
pub struct MobileProofData {
    /// Unique ID for the mobile device.
    pub mobile_device_id: BytesN<32>,
    /// Template used for mobile-optimized proofs.
    pub proof_template: Vec<u8>,
    /// Last usage timestamp.
    pub last_used: u64,
    /// Total number of proofs verified for this device.
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
