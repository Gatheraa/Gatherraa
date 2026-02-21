use soroban_sdk::{contracttype, Address, Bytes, String, Symbol};

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
    pub dex_pool_address: Address, // Fallback
    pub price_floor: i128,
    pub price_ceiling: i128,
    pub update_frequency: u64, // Seconds
    pub last_update_time: u64,
    pub is_frozen: bool,
    /// Asset pair string to query the oracle, e.g. "XLM/USD".
    pub oracle_pair: String,
    /// Reference baseline price from oracle (8 decimals) for computing the multiplier.
    /// Set this once at init time via a trusted first price; updated by `update_oracle_reference`.
    pub oracle_reference_price: i128,
    /// How old an oracle price can be (seconds) before we fall back to the DEX.
    pub max_oracle_age_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInfo {
    pub start_time: u64,
    pub refund_cutoff_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tier {
    pub name: String,
    pub base_price: i128,
    pub current_price: i128,
    pub max_supply: u32,
    pub minted: u32,
    pub active: bool,
    pub strategy: PricingStrategy,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ticket {
    pub tier_symbol: Symbol,
    pub purchase_time: u64,
    pub price_paid: i128,
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
    pub finalization_ledger: u32,
    pub reveal_start_ledger: u32,
    pub reveal_end_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AntiSnipingConfig {
    pub minimum_lock_period: u32,
    pub max_entries_per_address: u32,
    pub rate_limit_window: u64,
    pub randomization_delay_ledgers: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VRFState {
    pub randomness_generated: bool,
    pub randomness_hash: Bytes,
    pub batch_nonce: u32,
    pub finalization_ledger: u32,
}