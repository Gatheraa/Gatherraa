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

/// Standard error set for the Multisig Wallet Contract ecosystem.
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MultisigError {
    /// Contract is already initialized.
    AlreadyInitialized = 400,
    /// Contract is not yet initialized.
    NotInitialized = 401,
    /// Caller is not authorized for this operation.
    Unauthorized = 402,
    /// Provided signature is invalid.
    InvalidSignature = 403,
    /// Number of signatures is below the required threshold (m).
    InsufficientSignatures = 404,
    /// Signer address provided is not registered or valid.
    InvalidSigner = 405,
    /// Specified signer is currently inactive.
    SignerNotActive = 406,
    /// Provided amount parameter is invalid.
    InvalidAmount = 407,
    /// Wallet has insufficient balance for the transaction.
    InsufficientBalance = 408,
    /// Specified transaction ID was not found.
    TransactionNotFound = 409,
    /// Transaction parameters or status are invalid for this operation.
    InvalidTransaction = 410,
    /// Transaction has passed its mandatory expiry time.
    TransactionExpired = 411,
    /// Transaction has already been executed.
    TransactionAlreadyExecuted = 412,
    /// Operation would exceed the wallet's daily spending limit.
    DailySpendingLimitExceeded = 413,
    /// Timelock for this transaction has not yet expired.
    TimelockNotExpired = 414,
    /// Number of transactions in the batch exceeds the maximum allowed.
    BatchSizeExceeded = 415,
    /// Batch parameters or status are invalid.
    InvalidBatch = 416,
    /// Wallet is currently frozen by admin.
    WalletFrozen = 417,
    /// Specified role is invalid or not applicable.
    InvalidRole = 418,
    /// Signer address already exists in the wallet.
    DuplicateSigner = 419,
    /// Provided M-of-N configuration is invalid (e.g., m > n).
    InvalidMOfN = 420,
    /// Provided threshold value is invalid.
    InvalidThreshold = 421,
    /// Nonce has already been used.
    NonceUsed = 422,
    /// Provided nonce is invalid (e.g., lower than expected).
    InvalidNonce = 423,
    /// External token transfer operation failed.
    TransferFailed = 424,
    /// Contract is currently paused by admin.
    ContractPaused = 425,
    /// Provided address parameter is invalid.
    InvalidAddress = 426,
    /// Provided token address is invalid.
    InvalidToken = 427,
    /// Provided transaction data is invalid or malformed.
    InvalidData = 428,
    /// Operation is blocked because emergency freeze is currently active.
    EmergencyFreezeActive = 429,
    /// Internal arithmetic operation resulted in overflow/underflow.
    ArithmeticError = 430,
}
