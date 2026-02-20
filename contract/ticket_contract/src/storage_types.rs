use soroban_sdk::{contracttype, Address, String, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    EventInfo,
    TokenIdCounter,
    Tier(Symbol),
    Ticket(u32),
    PricingConfig,
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
