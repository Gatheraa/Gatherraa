use soroban_sdk::{contracttype, Address};

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
    Role(Symbol, Address),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub staking_token: Address,
    pub reward_token: Address,
    pub reward_rate: i128,
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
    pub lock_start_time: u64,
    pub lock_duration: u64,
    pub tier_id: u32,
}
