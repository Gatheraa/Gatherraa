use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, Vec, Map, U256, String, i128, u64, u32};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    Escrow(BytesN<32>),
    EventEscrows(Address),
    UserEscrows(Address),
    RevenueSplitConfig,
    ReferralTracker(Address),
    Dispute(BytesN<32>),
    Milestone(BytesN<32>),
    ContractConfig,
    EscrowStatus(BytesN<32>),
    EscrowReleaseTime(BytesN<32>),
}

#[derive(Clone)]
pub struct Escrow {
    pub id: BytesN<32>,
    pub event: Address,
    pub organizer: Address,
    pub purchaser: Address,
    pub amount: i128,
    pub token: Address,
    pub created_at: u64,
    pub release_time: u64,
    pub status: EscrowStatus,
    pub revenue_splits: RevenueSplit,
    pub referral: Option<Address>,
    pub milestones: Vec<Milestone>,
    pub dispute_active: bool,
}

#[derive(Clone, PartialEq)]
pub enum EscrowStatus {
    Pending,
    Locked,
    Released,
    Refunded,
    Disputed,
    Cancelled,
}

#[derive(Clone)]
pub struct RevenueSplit {
    pub organizer_percentage: u32,
    pub platform_percentage: u32,
    pub referral_percentage: u32,
    pub precision: u32,
}

#[derive(Clone)]
pub struct Milestone {
    pub id: u32,
    pub amount: i128,
    pub release_time: u64,
    pub released: bool,
}

#[derive(Clone)]
pub struct Dispute {
    pub escrow_id: BytesN<32>,
    pub challenger: Address,
    pub reason: Symbol,
    pub evidence: Vec<Symbol>,
    pub created_at: u64,
    pub resolved: bool,
    pub resolution: Option<DisputeResolution>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowContractConfig {
    pub admin: Address,
    pub escrow_management_contract: Address,
    pub dispute_resolution_contract: Address,
    pub revenue_splitting_contract: Address,
    pub referral_tracking_contract: Address,
}

#[derive(Clone)]
pub struct DisputeResolution {
    pub winner: Address,
    pub refund_amount: i128,
    pub penalty_amount: i128,
}

#[derive(Clone)]
pub struct ReferralTracker {
    pub referrer: Address,
    pub total_rewards: i128,
    pub referral_count: u32,
    pub last_referral: u64,
}

#[derive(Clone)]
pub struct RevenueSplitConfig {
    pub default_organizer_percentage: u32,
    pub default_platform_percentage: u32,
    pub default_referral_percentage: u32,
    pub max_referral_percentage: u32,
    pub precision: u32,
    pub min_escrow_amount: i128,
    pub max_escrow_amount: i128,
    pub dispute_timeout: u64,
    pub emergency_withdrawal_delay: u64,
}

// Custom errors
/// Standard error set for the Escrow Contract ecosystem.
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    /// Contract is already initialized.
    AlreadyInitialized = 600,
    /// Contract is not yet initialized.
    NotInitialized = 601,
    /// Caller is not authorized for this operation.
    Unauthorized = 602,
    /// Insufficient account balance for the transaction.
    InsufficientBalance = 603,
    /// Provided amount is invalid (e.g., negative).
    InvalidAmount = 604,
    /// Provided token address is invalid or not a contract.
    InvalidToken = 605,
    /// Escrow record not found in storage.
    EscrowNotFound = 606,
    /// Escrow status does not allow the requested operation.
    InvalidStatus = 607,
    /// An active dispute prevents the requested operation.
    DisputeActive = 608,
    /// No active dispute found for the given escrow.
    NoDispute = 609,
    /// The dispute resolution timeout has not yet expired.
    DisputeTimeout = 610,
    /// Provided percentage value is invalid (e.g., exceeds 100%).
    InvalidPercentage = 611,
    /// Specified milestone does not exist.
    InvalidMilestone = 612,
    /// Milestone has already been successfully released.
    MilestoneAlreadyReleased = 613,
    /// Provided time parameter is invalid.
    InvalidTime = 614,
    /// Contract is currently paused by admin.
    ContractPaused = 615,
    /// External token transfer operation failed.
    TransferFailed = 616,
    /// Provided address is invalid.
    InvalidAddress = 617,
    /// Amount is below the minimum required threshold.
    AmountTooLow = 618,
    /// Amount exceeds the maximum allowed threshold.
    AmountTooHigh = 619,
    /// Referral record not found.
    ReferralNotFound = 620,
    /// Referral has already been recorded for this user/escrow.
    DuplicateReferral = 621,
    /// Emergency withdrawal delay has not yet passed.
    EmergencyWithdrawalNotAvailable = 622,
    /// Internal arithmetic operation resulted in overflow/underflow.
    ArithmeticError = 623,
}
