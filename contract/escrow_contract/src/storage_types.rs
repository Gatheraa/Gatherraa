use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256};

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
}

#[contracttype]
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

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    Pending,
    Locked,
    Released,
    Refunded,
    Disputed,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct RevenueSplit {
    pub organizer_percentage: u32,
    pub platform_percentage: u32,
    pub referral_percentage: u32,
    pub precision: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub id: u32,
    pub amount: i128,
    pub release_time: u64,
    pub released: bool,
}

#[contracttype]
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
#[derive(Clone)]
pub struct DisputeResolution {
    pub winner: Address,
    pub refund_amount: i128,
    pub penalty_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct ReferralTracker {
    pub referrer: Address,
    pub total_rewards: i128,
    pub referral_count: u32,
    pub last_referral: u64,
}

#[contracttype]
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
