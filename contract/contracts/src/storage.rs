use crate::types::{Config, DataKey, Tier, UserInfo};
use soroban_sdk::{Address, Env};

const TTL_INSTANCE: u32 = 17280 * 30; // 30 days
const TTL_PERSISTENT: u32 = 17280 * 90; // 90 days

// Batch storage operations for better gas efficiency
pub struct StorageCache {
    pub config: Option<Config>,
    pub total_shares: Option<i128>,
    pub reward_per_token_stored: Option<i128>,
    pub last_update_time: Option<u64>,
}

impl StorageCache {
    pub fn new() -> Self {
        Self {
            config: None,
            total_shares: None,
            reward_per_token_stored: None,
            last_update_time: None,
        }
    }

    pub fn get_config(&mut self, env: &Env) -> &Config {
        if self.config.is_none() {
            self.config = Some(read_config(env));
        }
        self.config.as_ref().unwrap()
    }

    pub fn get_total_shares(&mut self, env: &Env) -> i128 {
        if self.total_shares.is_none() {
            self.total_shares = Some(read_total_shares(env));
        }
        self.total_shares.unwrap()
    }

    pub fn get_reward_per_token_stored(&mut self, env: &Env) -> i128 {
        if self.reward_per_token_stored.is_none() {
            self.reward_per_token_stored = Some(read_reward_per_token_stored(env));
        }
        self.reward_per_token_stored.unwrap()
    }

    pub fn get_last_update_time(&mut self, env: &Env) -> u64 {
        if self.last_update_time.is_none() {
            self.last_update_time = Some(read_last_update_time(env));
        }
        self.last_update_time.unwrap()
    }

    pub fn set_total_shares(&mut self, value: i128) {
        self.total_shares = Some(value);
    }
}

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

pub fn read_config(env: &Env) -> Config {
    env.storage().instance().get(&DataKey::Config).unwrap()
}

pub fn write_config(env: &Env, config: &Config) {
    env.storage().instance().set(&DataKey::Config, config);
}

pub fn read_tier(env: &Env, tier_id: u32) -> Option<Tier> {
    let key = DataKey::Tier(tier_id);
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
    }
    val
}

pub fn write_tier(env: &Env, tier_id: u32, tier: &Tier) {
    let key = DataKey::Tier(tier_id);
    env.storage().persistent().set(&key, tier);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
}

pub fn read_user_info(env: &Env, user: &Address) -> Option<UserInfo> {
    let key = DataKey::UserInfo(user.clone());
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
    }
    val
}

pub fn write_user_info(env: &Env, user: &Address, info: &UserInfo) {
    let key = DataKey::UserInfo(user.clone());
    env.storage().persistent().set(&key, info);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
}

pub fn read_reward_per_token_stored(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::RewardPerTokenStored)
        .unwrap_or(0)
}

pub fn write_reward_per_token_stored(env: &Env, val: i128) {
    env.storage()
        .instance()
        .set(&DataKey::RewardPerTokenStored, &val);
}

pub fn read_last_update_time(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::LastUpdateTime)
        .unwrap_or(0)
}

pub fn write_last_update_time(env: &Env, val: u64) {
    env.storage().instance().set(&DataKey::LastUpdateTime, &val);
}

pub fn read_total_shares(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalShares)
        .unwrap_or(0)
}

pub fn write_total_shares(env: &Env, shares: i128) {
    env.storage().instance().set(&DataKey::TotalShares, &shares);
}

pub fn has_role(env: &Env, role: Symbol, address: Address) -> bool {
    env.storage().persistent().has(&DataKey::Role(role, address))
}

pub fn write_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().set(&DataKey::Role(role, address), &true);
}

pub fn remove_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().remove(&DataKey::Role(role, address));
}
