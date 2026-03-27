use soroban_sdk::{contracttype, Address, Bytes, BytesN, String, Symbol};
use gathera_common::types::{
    Timestamp, TokenAmount, BasisPoints, DurationSeconds, LedgerSequence, DurationLedgers,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    EventInfo,
    TokenIdCounter,
    Tier(Symbol),
    Ticket(u32),
    PricingConfig,
    // VRF and Allocation keys
    VRFConfig,
    VRFState,
    AllocationStrategy(Symbol),
    AllocationState(Symbol),
    LotteryEntry(Symbol, u32),
    LotteryEntryCount(Symbol),
    WhitelistEntry(Symbol, Address),
    CommitmentHash(Address),
    LotteryResults(Symbol),
    AntiSnipingConfig(Symbol),
    UpgradeTimelock,
    Version,
    // Multi-source entropy keys
    EntropyProvider(Address),
    EntropySeed(Address, Symbol), // Seed from provider for specific tier
    EntropyProviders(Symbol), // List of providers for a tier
    VRFPublicKey, // Public key for verifying off-chain VRF proofs
    VRFProof(Symbol), // Latest verified VRF proof for a tier
    // Front-running mitigation keys
    PurchaseCommitment(Address),  // Stores a buyer's purchase commitment
    FrontRunMonitor(Address),     // Tracks suspicious activity per address
    MinRevealDelay,               // Global minimum delay (ledgers) between commit and reveal
    Role(Symbol, Address),
    ContractConfig, // Proxy contract configuration
    TokenName,
    TokenSymbol,
    TokenURI,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PricingStrategy {
    Standard,  // Normal demand-curve
    TimeDecay, // Decreases over time
    AbTestA,   // High floor
    AbTestB,   // Higher sensitivity
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PricingConfig {
    pub oracle_address: Address,
    /// Fallback DEX pool address for price discovery.
    pub dex_pool_address: Address,
    pub price_floor: TokenAmount,
    pub price_ceiling: TokenAmount,
    /// Minimum seconds between price updates.
    pub update_frequency: DurationSeconds,
    pub last_update_time: Timestamp,
    pub is_frozen: bool,
    /// Asset pair string to query the oracle, e.g. "XLM/USD".
    pub oracle_pair: String,
    /// Reference baseline price from oracle (8 decimals) for computing the multiplier.
    /// Set this once at init time via a trusted first price; updated by `update_oracle_reference`.
    pub oracle_reference_price: TokenAmount,
    /// How old an oracle price can be (seconds) before we fall back to the DEX.
    pub max_oracle_age_seconds: DurationSeconds,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInfo {
    pub start_time: Timestamp,
    pub refund_cutoff_time: Timestamp,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tier {
    pub name: String,
    pub base_price: TokenAmount,
    pub current_price: TokenAmount,
    pub max_supply: u32,
    pub minted: u32,
    pub active: bool,
    pub strategy: PricingStrategy,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ticket {
    pub tier_symbol: Symbol,
    pub purchase_time: Timestamp,
    pub price_paid: TokenAmount,
    pub is_valid: bool,
}
/// VRF-specific structures for ticket allocation

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AllocationStrategyType {
    FCFS,
    Lottery,
    Whitelist,
    HybridWhitelistLottery,
    TimeWeighted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllocationConfig {
    pub strategy: AllocationStrategyType,
    pub total_allocations: u32,
    pub allocated_count: u32,
    pub allocation_complete: bool,
    pub finalization_ledger: LedgerSequence,
    pub reveal_start_ledger: LedgerSequence,
    pub reveal_end_ledger: LedgerSequence,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AntiSnipingConfig {
    pub minimum_lock_period: DurationLedgers,
    pub max_entries_per_address: u32,
    pub rate_limit_window: DurationSeconds,
    pub randomization_delay_ledgers: DurationLedgers,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VRFState {
    pub randomness_generated: bool,
    pub randomness_hash: Bytes,
    pub batch_nonce: u32,
    pub finalization_ledger: LedgerSequence,
}
/// Stores a buyer's purchase commitment for the commit-reveal scheme.
/// The buyer first commits a hash of (buyer, tier_symbol, max_price, nonce),
/// then reveals those values after a minimum delay to complete the purchase.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PurchaseCommitment {
    /// SHA-256 hash of (buyer, tier_symbol, max_price, nonce)
    pub commitment_hash: BytesN<32>,
    /// Ledger sequence number when the commitment was made
    pub commit_ledger: u32,
    /// Tier the buyer intends to purchase
    pub tier_symbol: Symbol,
    /// Whether this commitment has already been revealed / consumed
    pub revealed: bool,
}

/// Tracks per-address activity to detect suspicious transaction patterns
/// such as repeated failed reveals or abnormally high commit frequency.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FrontRunMonitor {
    /// Number of commits in the current monitoring window
    pub commit_count: u32,
    /// Number of failed or expired reveals
    pub failed_reveals: u32,
    /// Ledger sequence at which the current monitoring window started
    pub window_start_ledger: u32,
    /// Whether the address is temporarily blocked
    pub is_blocked: bool,
}

#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TicketError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    TierNotFound = 3,
    TierAlreadyExists = 4,
    TierSoldOut = 5,
    TierNotActive = 6,
    InsufficientBalance = 7,
    InvalidAmount = 8,
    RefundWindowClosed = 9,
    TicketInvalid = 10,
    NotTicketOwner = 11,
    UpgradeNotScheduled = 12,
    UpgradeHashMismatch = 13,
    TimelockNotExpired = 14,
    InvalidVersion = 15,
    ArithmeticError = 16,
    // Front-running mitigation errors
    CommitmentNotFound = 17,
    CommitmentAlreadyRevealed = 18,
    RevealTooEarly = 19,
    InvalidCommitment = 20,
    PriceSlippageExceeded = 21,
    AddressBlocked = 22,
    CommitmentAlreadyExists = 23,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TicketContractConfig {
    pub admin: Address,
    pub pricing_contract: Address,
    pub allocation_contract: Address,
    pub vrf_contract: Address,
    pub commitment_contract: Address,
}
