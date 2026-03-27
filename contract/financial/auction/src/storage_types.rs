use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};
use gathera_common::types::{Timestamp, TokenAmount, DurationSeconds};

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
    pub initial_price: TokenAmount,
    pub reserve_price: TokenAmount,
    pub floor_price: TokenAmount,
    pub decay_constant: u32, // k in the exponential decay formula
    pub start_time: Timestamp,
    pub duration: DurationSeconds,
    pub extension_threshold: DurationSeconds, // Time before end that triggers extension
    pub extension_duration: DurationSeconds,   // How much to extend by
    pub current_price: TokenAmount,
    pub total_tickets: u32,
    pub sold_tickets: u32,
    pub status: AuctionStatus,
    pub bids: Vec<Bid>,
    pub winner_commitments: Map<Address, BytesN<32>>, // For commit-reveal
    pub final_extension_time: Timestamp,
    pub anti_bot_enabled: bool,
    pub min_bid_increment: TokenAmount,
}

#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub amount: TokenAmount,
    pub timestamp: Timestamp,
    pub commitment: Option<BytesN<32>>, // For commit-reveal scheme
    pub revealed: bool,
    pub ticket_ids: Vec<u32>,
    pub refund_amount: TokenAmount,
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
    pub default_duration: DurationSeconds,
    pub default_extension_threshold: DurationSeconds,
    pub default_extension_duration: DurationSeconds,
    pub default_decay_constant: u32,
    pub max_duration: DurationSeconds,
    pub min_duration: DurationSeconds,
    pub anti_bot_enabled: bool,
    pub rate_limit_window: DurationSeconds,
    pub rate_limit_max_bids: u32,
    pub commit_reveal_enabled: bool,
    pub commit_reveal_timeout: DurationSeconds,
}

#[derive(Clone)]
pub struct RateLimiter {
    pub address: Address,
    pub bid_count: u32,
    pub window_start: Timestamp,
    pub last_bid_time: Timestamp,
}

#[derive(Clone)]
pub struct CommitReveal {
    pub commitment: BytesN<32>,
    pub reveal_hash: Option<BytesN<32>>,
    pub reveal_time: Option<Timestamp>,
    pub amount: Option<TokenAmount>,
    pub revealed: bool,
}

/// Standard error set for the Dutch Auction Contract ecosystem.
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DutchAuctionError {
    /// Contract is already initialized.
    AlreadyInitialized = 500,
    /// Contract is not yet initialized.
    NotInitialized = 501,
    /// Caller is not authorized for this operation.
    Unauthorized = 502,
    /// Auction record not found in storage.
    AuctionNotFound = 503,
    /// Provided auction parameters are invalid.
    InvalidAuction = 504,
    /// Auction is not currently in the active status.
    AuctionNotActive = 505,
    /// Auction has already concluded.
    AuctionEnded = 506,
    /// Provided amount is invalid.
    InvalidAmount = 507,
    /// Insufficient account balance for bid/purchase.
    InsufficientBalance = 508,
    /// Bid is below the auction's mandatory reserve price.
    BelowReservePrice = 509,
    /// Bid is below the currently calculated floor price.
    BelowFloorPrice = 510,
    /// Provided bid parameter is invalid.
    InvalidBid = 511,
    /// Provided bid does not meet the minimum bid increment requirement.
    BidTooLow = 512,
    /// Rate limit for bidding has been exceeded.
    RateLimitExceeded = 513,
    /// Commit-reveal commitment is invalid or incorrectly formatted.
    InvalidCommitment = 514,
    /// Commitment for reveal was not found.
    CommitmentNotFound = 515,
    /// Reveal window has expired.
    RevealTimeout = 516,
    /// Bid has already been revealed.
    AlreadyRevealed = 517,
    /// Provided reveal parameters do not match the original commitment.
    InvalidReveal = 518,
    /// No tickets remain available for purchase.
    NoTicketsAvailable = 519,
    /// Automatic refund of unsuccessful bid failed.
    RefundFailed = 520,
    /// External token transfer operation failed.
    TransferFailed = 521,
    /// Contract is currenty paused by admin.
    ContractPaused = 522,
    /// Provided time parameter is invalid.
    InvalidTime = 523,
    /// Exponential decay constant is out of valid range.
    InvalidDecayConstant = 524,
    /// System-wide limit for concurrent auctions reached.
    ConcurrentAuctionLimit = 525,
    /// Potential front-run attempt detected by matching engine.
    FrontRunningDetected = 526,
    /// Provided ticket IDs are invalid or already taken.
    InvalidTicketIds = 527,
    /// Duplicate bid from the same account detected.
    DuplicateBid = 528,
    /// Auction has been cancelled by organizer/admin.
    AuctionCancelled = 529,
    /// Requested auction extension is not valid/applicable.
    ExtensionNotApplicable = 530,
    /// Internal arithmetic operation resulted in overflow/underflow.
    ArithmeticError = 531,
}
