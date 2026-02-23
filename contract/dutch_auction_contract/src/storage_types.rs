use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    Auction(BytesN<32>),
    ActiveAuctions,
    UserAuctions(Address),
    UserBids(Address),
    AuctionConfig,
    RateLimiter(Address),
    CommitReveal(BytesN<32>),
}

#[derive(Clone)]
pub struct Auction {
    pub id: BytesN<32>,
    pub organizer: Address,
    pub token: Address,
    pub ticket_nft: Address,
    pub initial_price: i128,
    pub reserve_price: i128,
    pub floor_price: i128,
    pub decay_constant: u32, // k in the exponential decay formula
    pub start_time: u64,
    pub duration: u64,
    pub extension_threshold: u64, // Time before end that triggers extension
    pub extension_duration: u64,   // How much to extend by
    pub current_price: i128,
    pub total_tickets: u32,
    pub sold_tickets: u32,
    pub status: AuctionStatus,
    pub bids: Vec<Bid>,
    pub winner_commitments: Map<Address, BytesN<32>>, // For commit-reveal
    pub final_extension_time: u64,
    pub anti_bot_enabled: bool,
    pub min_bid_increment: i128,
}

#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub commitment: Option<BytesN<32>>, // For commit-reveal scheme
    pub revealed: bool,
    pub ticket_ids: Vec<u32>,
    pub refund_amount: i128,
}

#[derive(Clone, PartialEq)]
pub enum AuctionStatus {
    Pending,
    Active,
    Ended,
    Cancelled,
}

#[derive(Clone)]
pub struct AuctionConfig {
    pub max_concurrent_auctions: u32,
    pub default_duration: u64,
    pub default_extension_threshold: u64,
    pub default_extension_duration: u64,
    pub default_decay_constant: u32,
    pub max_duration: u64,
    pub min_duration: u64,
    pub anti_bot_enabled: bool,
    pub rate_limit_window: u64,
    pub rate_limit_max_bids: u32,
    pub commit_reveal_enabled: bool,
    pub commit_reveal_timeout: u64,
}

#[derive(Clone)]
pub struct RateLimiter {
    pub address: Address,
    pub bid_count: u32,
    pub window_start: u64,
    pub last_bid_time: u64,
}

#[derive(Clone)]
pub struct CommitReveal {
    pub commitment: BytesN<32>,
    pub reveal_hash: Option<BytesN<32>>,
    pub reveal_time: Option<u64>,
    pub amount: Option<i128>,
    pub revealed: bool,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum DutchAuctionError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    AuctionNotFound,
    InvalidAuction,
    AuctionNotActive,
    AuctionEnded,
    InvalidAmount,
    InsufficientBalance,
    BelowReservePrice,
    BelowFloorPrice,
    InvalidBid,
    BidTooLow,
    RateLimitExceeded,
    InvalidCommitment,
    CommitmentNotFound,
    RevealTimeout,
    AlreadyRevealed,
    InvalidReveal,
    NoTicketsAvailable,
    RefundFailed,
    TransferFailed,
    ContractPaused,
    InvalidTime,
    InvalidDecayConstant,
    ConcurrentAuctionLimit,
    FrontRunningDetected,
    InvalidTicketIds,
    DuplicateBid,
    AuctionCancelled,
    ExtensionNotApplicable,
}
