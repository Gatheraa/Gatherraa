use soroban_sdk::{contracttype, Address, Symbol};
use gathera_common::types::{Timestamp, TokenAmount, DurationSeconds, TierId};

/// Storage keys for the Staking Contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Global configuration.
    Config,
    /// Reward tier information: [u32] (Tier ID).
    Tier(u32),
    /// Storage key for a specific staker: [Address].
    UserInfo(Address),
    /// Accumulated reward per token stored.
    RewardPerTokenStored,
    /// Last timestamp when rewards were updated.
    LastUpdateTime,
    /// Total number of shares across all users.
    TotalShares,
    /// Scheduled timelock for contract upgrades.
    UpgradeTimelock,
    /// Current logic version.
    Version,
    /// Access control roles: [(Symbol, Address)].
    Role(Symbol, Address),
}

/// Core configuration for the staking system.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    /// Administrator address.
    pub admin: Address,
    /// Token that users can stake.
    pub staking_token: Address,
    /// Token used for rewards.
    pub reward_token: Address,
    /// Global reward rate per second.
    pub reward_rate: TokenAmount,
}

/// A specific reward tier for staking.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tier {
    /// Minimum amount of tokens required for this tier.
    pub min_amount: TokenAmount,
    /// Reward multiplier (e.g., 100 = 1x, 150 = 1.5x).
    pub reward_multiplier: u32,
}

/// Tracks staking data for an individual user.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserInfo {
    /// Current amount of tokens staked.
    pub amount: TokenAmount,
    /// Equivalent shares based on reward tiers.
    pub shares: TokenAmount,
    /// Last reward per token amount that was paid out or updated.
    pub reward_per_token_paid: TokenAmount,
    /// Accumulated rewards waiting to be claimed.
    pub rewards: TokenAmount,
    /// Timestamp when the current stake was locked.
    pub lock_start_time: Timestamp,
    /// Total duration for which the stake is locked.
    pub lock_duration: DurationSeconds,
    /// Current assigned tier ID for the user.
    pub tier_id: TierId,
}
