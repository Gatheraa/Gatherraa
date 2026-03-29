use crate::types::{Config, DataKey, Tier, UserInfo, ChainConfig, CrossChainMessage};


use soroban_sdk::{Address, Env, Vec, Symbol, token};

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

pub fn write_total_shares(env: &Env, val: i128) {
    env.storage().instance().set(&DataKey::TotalShares, &val);
}

// Cross-chain storage functions
pub fn read_chain_config(env: &Env, chain_id: u32) -> Option<ChainConfig> {
    let key = DataKey::ChainConfig(chain_id);
    let val = env.storage().persistent().get(&key);
    if val.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
    }
    val
}

pub fn write_chain_config(env: &Env, chain_id: u32, config: &ChainConfig) {
    let key = DataKey::ChainConfig(chain_id);
    env.storage().persistent().set(&key, config);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_PERSISTENT, TTL_PERSISTENT);
}

pub fn read_supported_chains(env: &Env) -> Vec<u32> {
    let key = DataKey::SupportedChains;
    let val = env.storage().instance().get(&key);
    if val.is_some() {
        env.storage()
            .instance()
            .extend_ttl(&key, TTL_INSTANCE, TTL_INSTANCE);
    }
    val.unwrap_or_else(|| Vec::new(env))
}

pub fn write_supported_chains(env: &Env, chains: &Vec<u32>) {
    let key = DataKey::SupportedChains;
    env.storage().instance().set(&key, chains);
    env.storage()
        .instance()
        .extend_ttl(&key, TTL_INSTANCE, TTL_INSTANCE);
}

pub fn read_pending_messages(env: &Env, user: &Address) -> Vec<CrossChainMessage> {
    let key = DataKey::PendingMessages(user.clone());
    let val = env.storage().instance().get(&key);
    if val.is_some() {
        env.storage()
            .instance()
            .extend_ttl(&key, TTL_INSTANCE, TTL_INSTANCE);
    }
    val.unwrap_or_else(|| Vec::new(env))
}

pub fn write_pending_messages(env: &Env, user: &Address, messages: &Vec<CrossChainMessage>) {
    let key = DataKey::PendingMessages(user.clone());
    env.storage().instance().set(&key, messages);
    env.storage()
        .instance()
        .extend_ttl(&key, TTL_INSTANCE, TTL_INSTANCE);
}

pub fn write_pending_message(env: &Env, message: &CrossChainMessage) {
    let user = message.sender.clone();
    let mut messages = read_pending_messages(env, &user);
    messages.push_back(message.clone());
    write_pending_messages(env, &user, &messages);
}

pub fn remove_pending_message(env: &Env, nonce: u64) {
    // This would require iterating through all users' pending messages
    // For efficiency, we might want to use a different storage structure
    // For now, this is a placeholder implementation
}

pub fn read_message_nonce(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::MessageNonce)
        .unwrap_or(0)
}

pub fn write_message_nonce(env: &Env, nonce: u64) {
    env.storage().instance().set(&DataKey::MessageNonce, &nonce);
}

pub fn update_reward(env: &Env, user: Option<&Address>) {
    let config = read_config(env);
    let reward_token = token::Client::new(env, &config.reward_token);
    let staking_token = token::Client::new(env, &config.staking_token);
    let total_supply = staking_token.total_supply();

    if total_supply > 0 {
        let reward_per_token = (config.reward_rate * PRECISION) / total_supply;
        let mut reward_per_token_stored = read_reward_per_token_stored(env);
        reward_per_token_stored += reward_per_token;
        write_reward_per_token_stored(env, reward_per_token_stored);

        if let Some(user_addr) = user {
            if let Some(mut user_info) = read_user_info(env, user_addr) {
                let rewards = (user_info.shares * reward_per_token_stored) / PRECISION
                    - user_info.reward_per_token_paid;
                user_info.rewards += rewards;
                user_info.reward_per_token_paid = reward_per_token_stored;
                write_user_info(env, user_addr, &user_info);
            }
        }
    }

    write_last_update_time(env, env.ledger().timestamp());
}
