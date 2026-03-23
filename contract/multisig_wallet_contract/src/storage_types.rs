use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256};

#[contracttype]
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
    UserNonce(Address),
    Frozen,
}

#[contracttype]
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

#[contracttype]
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

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Owner,
    Treasurer,
    Auditor,
}

#[contracttype]
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

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TransactionStatus {
    Proposed,
    Approved,
    Executed,
    Rejected,
    Expired,
    Cancelled,
}

#[contracttype]
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

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum BatchStatus {
    Proposed,
    Approved,
    Executed,
    Rejected,
    Expired,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct TimelockQueue {
    pub pending: Vec<BytesN<32>>,
    pub ready: Vec<BytesN<32>>,
    pub executed: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub struct DailySpending {
    pub date: u64, // Unix timestamp for start of day
    pub spent: i128,
    pub limit: i128,
}

// NonceManager removed in favor of UserNonce(Address)

// Custom errors
#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
#[repr(u32)]
pub enum MultisigError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidSignature = 4,
    InsufficientSignatures = 5,
    InvalidSigner = 6,
    SignerNotActive = 7,
    InvalidAmount = 8,
    InsufficientBalance = 9,
    TransactionNotFound = 10,
    InvalidTransaction = 11,
    TransactionExpired = 12,
    TransactionAlreadyExecuted = 13,
    DailySpendingLimitExceeded = 14,
    TimelockNotExpired = 15,
    BatchSizeExceeded = 16,
    InvalidBatch = 17,
    WalletFrozen = 18,
    InvalidRole = 19,
    DuplicateSigner = 20,
    InvalidMOfN = 21,
    InvalidThreshold = 22,
    NonceUsed = 23,
    InvalidNonce = 24,
    TransferFailed = 25,
    ContractPaused = 26,
    InvalidAddress = 27,
    InvalidToken = 28,
    InvalidData = 29,
    EmergencyFreezeActive = 30,
    SignerAlreadyExists = 31,
    SignerNotFound = 32,
}
