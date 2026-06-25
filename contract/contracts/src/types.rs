use soroban_sdk::{contracttype, Address, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Tier(u32),
    UserInfo(Address),
    RewardPerTokenStored,
    LastUpdateTime,
    TotalShares,
    UpgradeTimelock,
    Version,
    ChainConfig(u32),
    SupportedChains,
    PendingMessages(Address),
    MessageNonce,
    BridgeValidator(Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub staking_token: Address,
    pub reward_token: Address,
    pub reward_rate: i128,
    pub chain_id: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tier {
    pub min_amount: i128,
    pub reward_multiplier: u32, // e.g., 100 for 1x, 150 for 1.5x
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserInfo {
    pub amount: i128,
    pub shares: i128,
    pub reward_per_token_paid: i128,
    pub rewards: i128,
    pub lock_until: u64,
    pub tier_id: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ChainConfig {
    pub chain_id: u32,
    pub chain_name: Symbol,
    pub bridge_address: Address,
    pub gas_limit: u32,
    pub confirmations: u32,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainMessage {
    pub message_type: Symbol,
    pub sender: Address,
    pub target_chain: u32,
    pub data: (i128, u64, u32), // (amount, lock_duration, tier_id)
    pub nonce: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BridgeConfig {
    pub bridge_address: Address,
    pub supported_chains: Vec<u32>,
    pub min_confirmations: u32,
    pub max_gas_limit: u32,
}

// Chain identifiers
pub const ETHEREUM_CHAIN_ID: u32 = 1;
pub const STELLAR_CHAIN_ID: u32 = 2;
pub const POLYGON_CHAIN_ID: u32 = 3;
pub const ARBITRUM_CHAIN_ID: u32 = 4;
pub const OPTIMISM_CHAIN_ID: u32 = 5;
pub const BASE_CHAIN_ID: u32 = 6;

// Message types
pub const MESSAGE_TYPE_STAKE: Symbol = Symbol::short("stake_msg");
pub const MESSAGE_TYPE_UNSTAKE: Symbol = Symbol::short("unstake_msg");
pub const MESSAGE_TYPE_REWARD: Symbol = Symbol::short("reward_msg");
pub const MESSAGE_TYPE_MIGRATE: Symbol = Symbol::short("migrate_msg");
