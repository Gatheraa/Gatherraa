use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256};

#[contracttype]
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
    UserNonce(Address),
    Frozen,
}

#[contracttype]
#[derive(Clone)]
pub struct WalletConfig {
    /// Number of required signatures (M in M-of-N).
    pub m: u32,
    /// Total number of signers (N in M-of-N).
    pub n: u32,
    /// Maximum amount allowed to be spent per day without extra approval.
    pub daily_spending_limit: i128,
    /// Transactions above this threshold require a timelock.
    pub timelock_threshold: i128,
    /// Mandatory waiting period for high-value transactions (seconds).
    pub timelock_duration: u64,
    /// Duration after which a proposed transaction expires (seconds).
    pub transaction_expiry: u64,
    /// Maximum number of transactions allowed in a single batch.
    pub max_batch_size: u32,
    /// Duration of a manual emergency freeze (seconds).
    pub emergency_freeze_duration: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Signer {
    /// The signer's address.
    pub address: Address,
    /// The role assigned to the signer (controls permissions).
    pub role: Role,
    /// The voting weight of the signer.
    pub weight: u32,
    /// Total amount spent by this signer today.
    pub daily_spent: i128,
    /// Timestamp when daily spent was last reset.
    pub last_spending_reset: u64,
    /// Whether the signer is currently active.
    pub active: bool,
    /// Timestamp when the signer was added to the wallet.
    pub added_at: u64,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// Full access owner.
    Owner,
    /// Can only propose and sign financial transactions.
    Treasurer,
    /// Can only view and audit transactions.
    Auditor,
}

#[contracttype]
#[derive(Clone)]
pub struct Transaction {
    /// Unique ID of the transaction.
    pub id: BytesN<32>,
    /// Destination address.
    pub to: Address,
    /// Token address for the transfer.
    pub token: Address,
    /// Amount to transfer.
    pub amount: i128,
    /// Optional data for contract calls.
    pub data: Vec<u8>,
    /// Address that proposed the transaction.
    pub proposer: Address,
    /// Collected signatures for this transaction.
    pub signatures: Vec<Address>,
    /// Current lifecycle status.
    pub status: TransactionStatus,
    /// Creation timestamp.
    pub created_at: u64,
    /// Expiration timestamp.
    pub expires_at: u64,
    /// Timestamp after which the transaction can be executed (if timelocked).
    pub timelock_until: u64,
    /// ID of the batch this transaction belongs to, if any.
    pub batch_id: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
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

#[contracttype]
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
    pub created_at: u64,
    /// Expiration timestamp.
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
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

#[contracttype]
#[derive(Clone)]
pub struct TimelockQueue {
    /// Transactions currently in their timelock period.
    pub pending: Vec<BytesN<32>>,
    /// Transactions that have surpassed their timelock.
    pub ready: Vec<BytesN<32>>,
    /// History of executed timelocked transactions.
    pub executed: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub struct DailySpending {
    /// The date (start of day).
    pub date: u64,
    /// Amount already spent today.
    pub spent: i128,
    /// Maximum limit for today.
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
