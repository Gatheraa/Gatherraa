use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, Vec, Map, U256, String, i128, u64, u32};
use gathera_common::types::{Timestamp, TokenAmount, Percentage, MilestoneId, DurationSeconds};

/// Storage keys for the Escrow Contract.
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

/// Represents an individual escrow agreement.
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
    pub amount: TokenAmount,
    /// Token address used for the escrow.
    pub token: Address,
    /// Timestamp when the escrow was created.
    pub created_at: Timestamp,
    /// Timestamp when the tokens are scheduled for release.
    pub release_time: Timestamp,
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

/// Lifecycle status of an escrow.
#[derive(Clone, PartialEq)]
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
}

/// Configuration for how funds are divided upon release.
#[derive(Clone)]
pub struct RevenueSplit {
    /// Percentage allocated to the organizer.
    pub organizer_percentage: Percentage,
    /// Percentage allocated to the platform.
    pub platform_percentage: Percentage,
    /// Percentage allocated to the referrer (if any).
    pub referral_percentage: Percentage,
    /// Calculation precision (e.g., 10000 for 100.00%).
    pub precision: u32,
}

/// A specific achievement or date that triggers a partial release of funds.
#[derive(Clone)]
pub struct Milestone {
    /// Unique identifier for the milestone within the escrow.
    pub id: MilestoneId,
    /// Amount of tokens to release upon completion.
    pub amount: TokenAmount,
    /// Minimum time before this milestone can be released.
    pub release_time: Timestamp,
    /// Whether the milestone has already been released.
    pub released: bool,
}

/// Details of a dispute raised against an escrow.
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
    pub created_at: Timestamp,
    /// Whether the dispute has been resolved.
    pub resolved: bool,
    /// Outcome of the dispute resolution.
    pub resolution: Option<DisputeResolution>,
}

/// Global settings for the Escrow Contract.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowContractConfig {
    /// The administrator address.
    pub admin: Address,
    /// Linked contract for escrow management logic.
    pub escrow_management_contract: Address,
    /// Linked contract for dispute resolution.
    pub dispute_resolution_contract: Address,
    /// Linked contract for revenue calculations.
    pub revenue_splitting_contract: Address,
    /// Linked contract for referral tracking.
    pub referral_tracking_contract: Address,
}

/// The outcome of a resolved dispute.
#[derive(Clone)]
pub struct DisputeResolution {
    /// Address awarded the funds.
    pub winner: Address,
    /// Amount returned to the purchaser.
    pub refund_amount: TokenAmount,
    /// Amount deducted as a penalty or platform fee.
    pub penalty_amount: TokenAmount,
}

/// Tracks referral activity and rewards for a user.
#[derive(Clone)]
pub struct ReferralTracker {
    /// The user being tracked.
    pub referrer: Address,
    /// Total rewards earned across all referrals.
    pub total_rewards: TokenAmount,
    /// Number of successful referrals.
    pub referral_count: u32,
    /// Timestamp of the last referral event.
    pub last_referral: Timestamp,
}

/// Global parameters for revenue splitting and timeouts.
#[derive(Clone)]
pub struct RevenueSplitConfig {
    /// Default organizer share.
    pub default_organizer_percentage: Percentage,
    /// Default platform fee.
    pub default_platform_percentage: Percentage,
    /// Default referral reward.
    pub default_referral_percentage: Percentage,
    /// Absolute maximum allowed referral reward.
    pub max_referral_percentage: Percentage,
    /// Precision used for percentage math.
    pub precision: u32,
    /// Minimum allowed escrow amount.
    pub min_escrow_amount: TokenAmount,
    /// Maximum allowed escrow amount.
    pub max_escrow_amount: TokenAmount,
    /// Seconds to wait before a dispute can be auto-resolved or escalated.
    pub dispute_timeout: DurationSeconds,
    /// Time delay for administrative emergency withdrawals.
    pub emergency_withdrawal_delay: DurationSeconds,
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
