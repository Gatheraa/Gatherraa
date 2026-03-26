use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    VRFRequest(BytesN<32>),
    RandomnessSeed,
    EntropyProvider(Address),
    RandomnessValidation,
    VRFProof(BytesN<32>),
    QualityMetrics,
    ProviderStats,
}

#[derive(Clone)]
pub struct VRFRequest {
    pub request_id: BytesN<32>,
    pub requester: Address,
    pub seed: BytesN<32>,
    pub additional_data: Vec<u8>,
    pub created_at: u64,
    pub fulfilled_at: Option<u64>,
    pub status: VRFStatus,
    pub proof: Option<VRFProof>,
    pub randomness_output: Option<BytesN<32>>,
    pub providers_used: Vec<Address>,
}

#[derive(Clone, PartialEq)]
pub enum VRFStatus {
    Pending,
    Processing,
    Fulfilled,
    Failed,
    Expired,
}

#[derive(Clone)]
pub struct VRFProof {
    pub proof_bytes: Vec<u8>,
    pub public_key: BytesN<32>,
    pub gamma: BytesN<32>,
    pub c: BytesN<32>,
    pub s: BytesN<32>,
    pub verification_hash: BytesN<32>,
    pub provider: Address,
    pub created_at: u64,
}

#[derive(Clone)]
pub struct EntropyProvider {
    pub address: Address,
    pub provider_type: ProviderType,
    pub public_key: BytesN<32>,
    pub reputation_score: u32,
    pub success_count: u32,
    pub failure_count: u32,
    pub last_used: u64,
    pub active: bool,
    pub weight: u32,
    pub fee: i128,
}

#[derive(Clone, PartialEq)]
pub enum ProviderType {
    Stellar,
    Oracle,
    Distributed,
    Hardware,
}

#[derive(Clone)]
pub struct RandomnessSeed {
    pub current_seed: BytesN<32>,
    pub previous_seed: BytesN<32>,
    pub block_number: u64,
    pub timestamp: u64,
    pub entropy_sources: Vec<EntropySource>,
    pub quality_score: f32,
}

#[derive(Clone)]
pub struct EntropySource {
    pub source_type: SourceType,
    pub value: BytesN<32>,
    pub weight: u32,
    pub timestamp: u64,
    pub reliability: f32,
}

#[derive(Clone, PartialEq)]
pub enum SourceType {
    BlockHash,
    Timestamp,
    TransactionHash,
    LedgerSequence,
    ProviderEntropy,
    NetworkEntropy,
    SystemEntropy,
}

#[derive(Clone)]
pub struct RandomnessValidation {
    pub validation_id: BytesN<32>,
    pub randomness: BytesN<32>,
    pub test_results: Vec<TestResult>,
    pub overall_score: f32,
    pub passed: bool,
    pub timestamp: u64,
    pub validator: Address,
}

#[derive(Clone)]
pub struct TestResult {
    pub test_name: Symbol,
    pub passed: bool,
    pub score: f32,
    pub details: Vec<u8>,
}

#[derive(Clone)]
pub struct QualityMetrics {
    pub total_requests: u32,
    pub successful_requests: u32,
    pub average_response_time: u64,
    pub randomness_quality_score: f32,
    pub provider_diversity: f32,
    pub last_updated: u64,
}

#[derive(Clone)]
pub struct ProviderStats {
    pub provider: Address,
    pub total_requests: u32,
    pub successful_requests: u32,
    pub average_response_time: u64,
    pub reputation_history: Vec<u32>,
    pub last_updated: u64,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum VRFError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    RequestNotFound,
    InvalidProof,
    InvalidSeed,
    ProviderNotFound,
    InsufficientEntropy,
    ValidationFailed,
    RandomnessQualityLow,
    RequestExpired,
    DuplicateRequest,
    InvalidProvider,
    ProviderInactive,
    InsufficientFee,
    InvalidSignature,
    InvalidPublicKey,
    InvalidAdditionalData,
    TooManyProviders,
    EntropySourceUnavailable,
    TestFailed,
    QualityThresholdNotMet,
    ContractPaused,
    StorageError,
    SerializationError,
}
