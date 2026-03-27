use soroban_sdk::{contracttype, Address, Bytes, String, Symbol};
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
