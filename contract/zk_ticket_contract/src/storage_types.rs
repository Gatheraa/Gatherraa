use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};
use gathera_common::types::Timestamp;

/// Storage keys for the ZK Ticket Contract.
#[derive(Clone)]
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
    /// Data for a specific batch verification operation: [BytesN<32>].
    BatchVerification(BytesN<32>),
}

/// Represents a validated Zero-Knowledge proof for a ticket.
#[derive(Clone)]
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
    pub created_at: Timestamp,
    /// Timestamp when verification was completed.
    pub verified_at: Option<Timestamp>,
    /// Expiration timestamp for this proof.
    pub expires_at: Timestamp,
    /// Flag indicating if the proof has been revoked.
    pub revoked: bool,
    /// ID of the batch this proof was verified in, if any.
    pub batch_id: Option<BytesN<32>>,
}

/// An attribute associated with a ZK ticket (e.g., Seat Number, Price).
#[derive(Clone)]
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

/// Types of attributes that can be embedded in a ZK ticket.
#[derive(Clone, PartialEq)]
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
pub struct TicketCommitment {
    /// The unique commitment hash.
    pub commitment: BytesN<32>,
    /// The event this ticket belongs to.
    pub event_id: Address,
    /// Hash of the base ticket data.
    pub ticket_hash: BytesN<32>,
    /// Creation timestamp.
    pub created_at: Timestamp,
    /// The nullifier that will be revealed upon use.
    pub nullifier: BytesN<32>,
    /// Combined hash of all attribute commitments.
    pub attributes_hash: BytesN<32>,
    /// Whether the commitment is currently valid.
    pub active: bool,
}

/// Tracks the usage status of a nullifier to prevent double-spending.
#[derive(Clone)]
pub struct NullifierInfo {
    /// The nullifier hash.
    pub nullifier: BytesN<32>,
    /// Whether this nullifier has been used (revealed).
    pub used: bool,
    /// When the nullifier was used.
    pub used_at: Option<Timestamp>,
    /// The proof ID that revealed this nullifier.
    pub proof_id: Option<BytesN<32>>,
}

/// Collection of commitments belonging to a specific event.
#[derive(Clone)]
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
    pub created_at: Timestamp,
    pub circuit_params: CircuitParameters,
}

/// Cryptographic parameters for the ZK circuit.
#[derive(Clone)]
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
pub struct VerificationCache {
    /// Unique key for the cached item.
    pub cache_key: BytesN<32>,
    /// Result of the verification (true = valid).
    pub result: bool,
    /// Timestamp when the result was cached.
    pub timestamp: Timestamp,
    /// ID of the proof being cached.
    pub proof_id: BytesN<32>,
}

/// List of revoked commitments and nullifiers.
#[derive(Clone)]
pub struct RevocationList {
    /// Commitments that have been manually revoked.
    pub revoked_commitments: Vec<BytesN<32>>,
    /// Nullifiers associated with revoked tickets.
    pub revoked_nullifiers: Vec<BytesN<32>>,
    /// Last update timestamp.
    pub last_updated: Timestamp,
}

/// Status and data for a batch verification operation.
#[derive(Clone)]
pub struct BatchVerification {
    /// Unique ID for the batch.
    pub batch_id: BytesN<32>,
    /// List of proof IDs in this batch.
    pub proofs: Vec<BytesN<32>>,
    /// Parallel list of verification results.
    pub results: Vec<bool>,
    /// Initiation timestamp.
    pub created_at: Timestamp,
    /// Completion timestamp.
    pub completed_at: Option<Timestamp>,
    /// Current status of the batch.
    pub status: BatchStatus,
}

/// Lifecycle status of a batch verification.
#[derive(Clone, PartialEq)]
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
pub struct MobileProofData {
    /// Unique ID for the mobile device.
    pub mobile_device_id: BytesN<32>,
    /// Template used for mobile-optimized proofs.
    pub proof_template: Vec<u8>,
    /// Last usage timestamp.
    pub last_used: Timestamp,
    /// Total number of proofs verified for this device.
    pub usage_count: u32,
}

/// Errors specific to the ZK Ticket Contract.
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ZKTicketError {
    /// Contract already initialized.
    AlreadyInitialized = 1,
    /// Contract not yet initialized.
    NotInitialized = 2,
    /// Unauthorized caller.
    Unauthorized = 3,
    /// The specified ZK proof was not found.
    ProofNotFound = 4,
    /// The provided proof data is invalid or malformed.
    InvalidProof = 5,
    /// The proof has expired.
    ProofExpired = 6,
    /// The nullifier has already been used (double-spend).
    NullifierAlreadyUsed = 7,
    /// The ticket commitment is invalid or unknown.
    InvalidCommitment = 8,
    /// The ticket has been revoked by the issuer.
    TicketRevoked = 9,
    /// Cryptographic verification of the proof failed.
    VerificationFailed = 10,
    /// One or more attributes are invalid or mismatched.
    InvalidAttribute = 11,
    /// The circuit parameters are invalid.
    InvalidCircuitParams = 12,
    /// The specified batch was not found.
    BatchNotFound = 13,
    /// The batch is currently being processed.
    BatchProcessing = 14,
    /// Mobile-optimized verification failed.
    MobileVerificationFailed = 15,
    /// Cryptographic signature is invalid.
    InvalidSignature = 16,
    /// An attribute was expected to be revealed but was not.
    AttributeNotRevealed = 17,
    /// A duplicate commitment was detected for an event.
    DuplicateCommitment = 18,
    /// The event ID is invalid or points to an incorrect contract.
    InvalidEventId = 19,
    /// Insufficient attributes provided for the circuit.
    InsufficientAttributes = 20,
    /// The proof data exceeds maximum allowable length.
    ProofTooLarge = 21,
    /// Proof was generated for a different circuit version.
    CircuitMismatch = 22,
    /// Revocation operation failed.
    RevocationFailed = 23,
    /// Verification result has aged out of the cache.
    CacheExpired = 24,
    /// Batch size exceeds maximum limit.
    BatchSizeExceeded = 25,
    /// The provided nullifier is malformed.
    InvalidNullifier = 26,
    /// The operation timestamp is invalid or out of range.
    InvalidTimestamp = 27,
    /// The contract is currently paused.
    ContractPaused = 28,
    /// An arithmetic error occurred.
    ArithmeticError = 29,
}
