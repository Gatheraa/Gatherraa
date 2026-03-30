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
    /// Storage key for a specific escrow: [BytesN<32>].
    Escrow(BytesN<32>),
    /// List of escrows associated with an event: [Address].
    EventEscrows(Address),
    /// List of escrows associated with a user: [Address].
    UserEscrows(Address),
    /// Global configuration for revenue splitting.
    RevenueSplitConfig,
    /// Referral tracking data for a specific user: [Address].
    ReferralTracker(Address),
    /// Information about a specific dispute: [BytesN<32>].
    Dispute(BytesN<32>),
    /// Information about a specific milestone: [BytesN<32>].
    Milestone(BytesN<32>),
    /// Global configuration for the contract.
    ContractConfig,
    /// Cached status of an escrow: [BytesN<32>].
    EscrowStatus(BytesN<32>),
    /// Release time for an escrow: [BytesN<32>].
    EscrowReleaseTime(BytesN<32>),
}

#[contracttype]
#[derive(Clone)]
pub struct Escrow {
    /// Unique identifier for the escrow.
    pub id: BytesN<32>,
    /// Address of the event related to this escrow.
    pub event: Address,
    /// Address of the service provider/organizer.
    pub organizer: Address,
    /// Address of the student/purchaser.
    pub purchaser: Address,
    /// Total amount of tokens locked.
    pub amount: i128,
    /// Token address used for the escrow.
    pub token: Address,
    /// Timestamp when the escrow was created.
    pub created_at: u64,
    /// Timestamp when the tokens are scheduled for release.
    pub release_time: u64,
    /// Current status of the escrow.
    pub status: EscrowStatus,
    /// Revenue split configuration for this escrow.
    pub revenue_splits: RevenueSplit,
    /// Optional referrer address.
    pub referral: Option<Address>,
    /// Optional milestones for partial releases.
    pub milestones: Vec<Milestone>,
    /// Whether a dispute is currently active for this escrow.
    pub dispute_active: bool,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    /// Initial state, waiting for funding or verification.
    Pending,
    /// Funds are successfully locked in the contract.
    Locked,
    /// Funds have been released to the organizer.
    Released,
    /// Funds have been sent back to the purchaser.
    Refunded,
    /// Escrow is frozen due to a dispute.
    Disputed,
    /// Escrow was cancelled before completion.
    Cancelled,
    /// Funds are active and available for use
    Active,
}

#[contracttype]
#[derive(Clone)]
pub struct RevenueSplit {
    /// Percentage allocated to the organizer.
    pub organizer_percentage: u32,
    /// Percentage allocated to the platform.
    pub platform_percentage: u32,
    /// Percentage allocated to the referrer (if any).
    pub referral_percentage: u32,
    /// Calculation precision (e.g., 10000 for 100.00%).
    pub precision: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    /// Unique identifier for the milestone within the escrow.
    pub id: u32,
    /// Amount of tokens to release upon completion.
    pub amount: i128,
    /// Minimum time before this milestone can be released.
    pub release_time: u64,
    /// Whether the milestone has already been released.
    pub released: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Dispute {
    /// The ID of the disputed escrow.
    pub escrow_id: BytesN<32>,
    /// The address that initiated the dispute.
    pub challenger: Address,
    /// Symbol representing the reason for the dispute.
    pub reason: Symbol,
    /// List of symbols linking to evidence (e.g., hash of documents).
    pub evidence: Vec<Symbol>,
    /// Timestamp when the dispute was created.
    pub created_at: u64,
    /// Whether the dispute has been resolved.
    pub resolved: bool,
    /// Outcome of the dispute resolution.
    pub resolution: Option<DisputeResolution>,
}

#[contracttype]
#[derive(Clone)]
pub struct DisputeResolution {
    /// Address awarded the funds.
    pub winner: Address,
    /// Amount returned to the purchaser.
    pub refund_amount: i128,
    /// Amount deducted as a penalty or platform fee.
    pub penalty_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ReferralTracker {
    /// The user being tracked.
    pub referrer: Address,
    /// Total rewards earned across all referrals.
    pub total_rewards: i128,
    /// Number of successful referrals.
    pub referral_count: u32,
    /// Timestamp of the last referral event.
    pub last_referral: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct RevenueSplitConfig {
    /// Default organizer share.
    pub default_organizer_percentage: u32,
    /// Default platform fee.
    pub default_platform_percentage: u32,
    /// Default referral reward.
    pub default_referral_percentage: u32,
    /// Absolute maximum allowed referral reward.
    pub max_referral_percentage: u32,
    /// Precision used for percentage math.
    pub precision: u32,
    /// Minimum allowed escrow amount.
    pub min_escrow_amount: i128,
    /// Maximum allowed escrow amount.
    pub max_escrow_amount: i128,
    /// Seconds to wait before a dispute can be auto-resolved or escalated.
    pub dispute_timeout: u64,
    /// Time delay for administrative emergency withdrawals.
    pub emergency_withdrawal_delay: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowContractConfig {
    pub admin: Address,
    pub escrow_management_contract: Address,
    pub dispute_resolution_contract: Address,
    pub revenue_splitting_contract: Address,
    pub referral_tracking_contract: Address,
}

// Custom errors
#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
    InvalidToken = 6,
    EscrowNotFound = 7,
    InvalidStatus = 8,
    DisputeActive = 9,
    NoDispute = 10,
    DisputeTimeout = 11,
    InvalidPercentage = 12,
    InvalidMilestone = 13,
    MilestoneAlreadyReleased = 14,
    InvalidTime = 15,
    ContractPaused = 16,
    TransferFailed = 17,
    InvalidAddress = 18,
    AmountTooLow = 19,
    AmountTooHigh = 20,
    ReferralNotFound = 21,
    DuplicateReferral = 22,
    EmergencyWithdrawalNotAvailable = 23,
}
