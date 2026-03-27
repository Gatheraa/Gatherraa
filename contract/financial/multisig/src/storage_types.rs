use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};
use gathera_common::types::{Timestamp, TokenAmount, DurationSeconds, SignerWeight};

/// Storage keys for the Multisig Wallet Contract.
#[derive(Clone)]
pub enum DataKey {
    /// The administrator address.
    Admin,
    /// Boolean flag indicating if the contract is paused.
    Paused,
    /// Current logic version of the contract.
    Version,
    /// Global configuration for the multisig wallet.
    WalletConfig,
    /// List of all registered signers.
    Signers,
    /// Storage key for a specific transaction: [BytesN<32>].
    Transaction(BytesN<32>),
    /// Storage key for a specific batch: [BytesN<32>].
    Batch(BytesN<32>),
    /// Daily spending tracking for a specific date (start_of_day timestamp).
    DailySpending(u64),
    /// Queue for transactions subject to timelocks.
    TimelockQueue,
    /// Managed nonces for replay protection.
    Nonce,
    /// Flag indicating if the wallet is currently frozen.
    Frozen,
}

/// Configuration settings for the multisig wallet.
#[derive(Clone)]
pub struct WalletConfig {
    /// Number of required signatures (M in M-of-N).
    pub m: u32,
    /// Total number of signers (N in M-of-N).
    pub n: u32,
    /// Maximum amount allowed to be spent per day without extra approval.
    pub daily_spending_limit: TokenAmount,
    /// Transactions above this threshold require a timelock.
    pub timelock_threshold: TokenAmount,
    /// Mandatory waiting period for high-value transactions (seconds).
    pub timelock_duration: DurationSeconds,
    /// Duration after which a proposed transaction expires (seconds).
    pub transaction_expiry: DurationSeconds,
    /// Maximum number of transactions allowed in a single batch.
    pub max_batch_size: u32,
    /// Duration of a manual emergency freeze (seconds).
    pub emergency_freeze_duration: DurationSeconds,
}

/// A registered signer in the multisig wallet.
#[derive(Clone)]
pub struct Signer {
    /// The signer's address.
    pub address: Address,
    /// The role assigned to the signer (controls permissions).
    pub role: Role,
    /// The voting weight of the signer.
    pub weight: SignerWeight,
    /// Total amount spent by this signer today.
    pub daily_spent: TokenAmount,
    /// Timestamp when daily spent was last reset.
    pub last_spending_reset: Timestamp,
    /// Whether the signer is currently active.
    pub active: bool,
    /// Timestamp when the signer was added to the wallet.
    pub added_at: Timestamp,
}

/// Roles that can be assigned to signers.
#[derive(Clone, PartialEq)]
pub enum Role {
    /// Full access owner.
    Owner,
    /// Can only propose and sign financial transactions.
    Treasurer,
    /// Can only view and audit transactions.
    Auditor,
}

/// Represents a proposed transaction in the wallet.
#[derive(Clone)]
pub struct Transaction {
    /// Unique ID of the transaction.
    pub id: BytesN<32>,
    /// Destination address.
    pub to: Address,
    /// Token address for the transfer.
    pub token: Address,
    /// Amount to transfer.
    pub amount: TokenAmount,
    /// Optional data for contract calls.
    pub data: Vec<u8>,
    /// Address that proposed the transaction.
    pub proposer: Address,
    /// Collected signatures for this transaction.
    pub signatures: Vec<Address>,
    /// Current lifecycle status.
    pub status: TransactionStatus,
    /// Creation timestamp.
    pub created_at: Timestamp,
    /// Expiration timestamp.
    pub expires_at: Timestamp,
    /// Timestamp after which the transaction can be executed (if timelocked).
    pub timelock_until: Timestamp,
    /// ID of the batch this transaction belongs to, if any.
    pub batch_id: Option<BytesN<32>>,
}

/// Lifecycle status of a transaction.
#[derive(Clone, PartialEq)]
pub enum TransactionStatus {
    /// Proposed and waiting for signatures.
    Proposed,
    /// Threshold met, ready for execution (or timelock).
    Approved,
    /// Successfully executed.
    Executed,
    /// Explicitly rejected by enough signers.
    Rejected,
    /// Reached expiry time without enough signatures.
    Expired,
    /// Cancelled by the proposer or admin.
    Cancelled,
}

/// A group of transactions to be executed atomically or sequentially as a unit.
#[derive(Clone)]
pub struct Batch {
    /// Unique ID of the batch.
    pub id: BytesN<32>,
    /// List of transaction IDs in the batch.
    pub transactions: Vec<BytesN<32>>,
    /// Address that proposed the batch.
    pub proposer: Address,
    /// Collected signatures for the batch.
    pub signatures: Vec<Address>,
    /// Current batch lifecycle status.
    pub status: BatchStatus,
    /// Creation timestamp.
    pub created_at: Timestamp,
    /// Expiration timestamp.
    pub expires_at: Timestamp,
}

/// Lifecycle status of a batch.
#[derive(Clone, PartialEq)]
pub enum BatchStatus {
    /// Proposed and waiting for signatures.
    Proposed,
    /// Threshold met, ready for execution.
    Approved,
    /// Successfully executed.
    Executed,
    /// Explicitly rejected.
    Rejected,
    /// Reached expiry time.
    Expired,
    /// Manually cancelled.
    Cancelled,
}

/// Queues for tracking timelocked transactions.
#[derive(Clone)]
pub struct TimelockQueue {
    /// Transactions currently in their timelock period.
    pub pending: Vec<BytesN<32>>,
    /// Transactions that have surpassed their timelock.
    pub ready: Vec<BytesN<32>>,
    /// History of executed timelocked transactions.
    pub executed: Vec<BytesN<32>>,
}

/// Daily spending tracking for the wallet.
#[derive(Clone)]
pub struct DailySpending {
    /// The date (start of day).
    pub date: Timestamp,
    /// Amount already spent today.
    pub spent: TokenAmount,
    /// Maximum limit for today.
    pub limit: TokenAmount,
}

/// Managed nonces for replay protection across signatures.
#[derive(Clone)]
pub struct NonceManager {
    /// Global nonce counter.
    pub current_nonce: u64,
    /// Per-signer used nonces for parallel processing support.
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
