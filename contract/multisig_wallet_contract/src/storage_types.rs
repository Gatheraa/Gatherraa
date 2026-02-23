use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    WalletConfig,
    Signers,
    Transaction(BytesN<32>),
    Batch(BytesN<32>),
    DailySpending(u64), // Date as key
    TimelockQueue,
    Nonce,
    Frozen,
}

#[derive(Clone)]
pub struct WalletConfig {
    pub m: u32, // Number of required signatures
    pub n: u32, // Total number of signers
    pub daily_spending_limit: i128,
    pub timelock_threshold: i128,
    pub timelock_duration: u64,
    pub transaction_expiry: u64,
    pub max_batch_size: u32,
    pub emergency_freeze_duration: u64,
}

#[derive(Clone)]
pub struct Signer {
    pub address: Address,
    pub role: Role,
    pub weight: u32,
    pub daily_spent: i128,
    pub last_spending_reset: u64,
    pub active: bool,
    pub added_at: u64,
}

#[derive(Clone, PartialEq)]
pub enum Role {
    Owner,
    Treasurer,
    Auditor,
}

#[derive(Clone)]
pub struct Transaction {
    pub id: BytesN<32>,
    pub to: Address,
    pub token: Address,
    pub amount: i128,
    pub data: Vec<u8>,
    pub proposer: Address,
    pub signatures: Vec<Address>,
    pub status: TransactionStatus,
    pub created_at: u64,
    pub expires_at: u64,
    pub timelock_until: u64,
    pub batch_id: Option<BytesN<32>>,
}

#[derive(Clone, PartialEq)]
pub enum TransactionStatus {
    Proposed,
    Approved,
    Executed,
    Rejected,
    Expired,
    Cancelled,
}

#[derive(Clone)]
pub struct Batch {
    pub id: BytesN<32>,
    pub transactions: Vec<BytesN<32>>,
    pub proposer: Address,
    pub signatures: Vec<Address>,
    pub status: BatchStatus,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(Clone, PartialEq)]
pub enum BatchStatus {
    Proposed,
    Approved,
    Executed,
    Rejected,
    Expired,
    Cancelled,
}

#[derive(Clone)]
pub struct TimelockQueue {
    pub pending: Vec<BytesN<32>>,
    pub ready: Vec<BytesN<32>>,
    pub executed: Vec<BytesN<32>>,
}

#[derive(Clone)]
pub struct DailySpending {
    pub date: u64, // Unix timestamp for start of day
    pub spent: i128,
    pub limit: i128,
}

#[derive(Clone)]
pub struct NonceManager {
    pub current_nonce: u64,
    pub used_nonces: Map<Address, u64>,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum MultisigError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    InvalidSignature,
    InsufficientSignatures,
    InvalidSigner,
    SignerNotActive,
    InvalidAmount,
    InsufficientBalance,
    TransactionNotFound,
    InvalidTransaction,
    TransactionExpired,
    TransactionAlreadyExecuted,
    DailySpendingLimitExceeded,
    TimelockNotExpired,
    BatchSizeExceeded,
    InvalidBatch,
    WalletFrozen,
    InvalidRole,
    DuplicateSigner,
    InvalidMOfN,
    InvalidThreshold,
    NonceUsed,
    InvalidNonce,
    TransferFailed,
    ContractPaused,
    InvalidAddress,
    InvalidToken,
    InvalidData,
    EmergencyFreezeActive,
}
