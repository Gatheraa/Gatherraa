use crate::types::{ChainConfig, Config, CrossChainMessage, DataKey, Tier, UserInfo};

use soroban_sdk::{token, Address, Env, Vec};

const TTL_INSTANCE: u32 = 17280 * 30; // 30 days
const TTL_PERSISTENT: u32 = 17280 * 90; // 90 days
const PRECISION: i128 = 1_000_000_000;

/// Upper bound for per-second reward emission before precision scaling.
///
/// `update_reward` multiplies `reward_rate * PRECISION`; capping the stored
/// emission rate here keeps that scaling inside i128 before any division by
/// total supply.
const MAX_REWARD_RATE: i128 = i128::MAX / PRECISION;
const REWARD_ARITHMETIC_OVERFLOW: &str = "reward calculation overflow";

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

fn bounded_reward_rate(reward_rate: i128) -> i128 {
    if reward_rate <= 0 {
        0
    } else if reward_rate > MAX_REWARD_RATE {
        MAX_REWARD_RATE
    } else {
        reward_rate
    }
}

fn checked_reward_per_token(reward_rate: i128, total_supply: i128) -> Option<i128> {
    if total_supply <= 0 {
        return None;
    }

    bounded_reward_rate(reward_rate)
        .checked_mul(PRECISION)
        .and_then(|scaled_rate| scaled_rate.checked_div(total_supply))
}

fn checked_reward_per_token_stored(current: i128, increment: i128) -> Option<i128> {
    current.checked_add(increment)
}

fn checked_user_reward_delta(
    shares: i128,
    reward_per_token_stored: i128,
    reward_per_token_paid: i128,
) -> Option<i128> {
    shares
        .checked_mul(reward_per_token_stored)
        .and_then(|scaled_rewards| scaled_rewards.checked_div(PRECISION))
        .and_then(|gross_rewards| gross_rewards.checked_sub(reward_per_token_paid))
}

fn checked_accumulated_rewards(current: i128, delta: i128) -> Option<i128> {
    current.checked_add(delta)
}

pub fn update_reward(env: &Env, user: Option<&Address>) {
    let config = read_config(env);
    let staking_token = token::Client::new(env, &config.staking_token);
    let total_supply = staking_token.total_supply();

    if total_supply > 0 {
        let reward_per_token = checked_reward_per_token(config.reward_rate, total_supply)
            .unwrap_or_else(|| panic!("{}", REWARD_ARITHMETIC_OVERFLOW));
        let reward_per_token_stored =
            checked_reward_per_token_stored(read_reward_per_token_stored(env), reward_per_token)
                .unwrap_or_else(|| panic!("{}", REWARD_ARITHMETIC_OVERFLOW));
        write_reward_per_token_stored(env, reward_per_token_stored);

        if let Some(user_addr) = user {
            if let Some(mut user_info) = read_user_info(env, user_addr) {
                let rewards = checked_user_reward_delta(
                    user_info.shares,
                    reward_per_token_stored,
                    user_info.reward_per_token_paid,
                )
                .unwrap_or_else(|| panic!("{}", REWARD_ARITHMETIC_OVERFLOW));
                user_info.rewards = checked_accumulated_rewards(user_info.rewards, rewards)
                    .unwrap_or_else(|| panic!("{}", REWARD_ARITHMETIC_OVERFLOW));
                user_info.reward_per_token_paid = reward_per_token_stored;
                write_user_info(env, user_addr, &user_info);
            }
        }
    }

    write_last_update_time(env, env.ledger().timestamp());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caps_reward_rate_before_precision_scaling() {
        let capped_scaled_rate = MAX_REWARD_RATE.checked_mul(PRECISION).unwrap();

        assert_eq!(bounded_reward_rate(-1), 0);
        assert_eq!(bounded_reward_rate(MAX_REWARD_RATE + 1), MAX_REWARD_RATE);
        assert_eq!(
            checked_reward_per_token(MAX_REWARD_RATE + 1, 1),
            Some(capped_scaled_rate)
        );
    }

    #[test]
    fn detects_stored_reward_overflow() {
        assert_eq!(checked_reward_per_token_stored(i128::MAX, 1), None);
    }

    #[test]
    fn near_max_reward_rates_do_not_wrap_before_division() {
        let total_supplies = [1, 7, 1_000_000, 1_000_000_000_000];

        for offset in [0, 1, 1_000, 1_000_000] {
            for total_supply in total_supplies {
                let reward_rate = MAX_REWARD_RATE.saturating_sub(offset);
                let expected = reward_rate
                    .checked_mul(PRECISION)
                    .and_then(|scaled_rate| scaled_rate.checked_div(total_supply));

                assert_eq!(
                    checked_reward_per_token(reward_rate, total_supply),
                    expected
                );
            }
        }
    }

    #[test]
    fn near_max_user_shares_do_not_wrap_reward_delta() {
        let share_divisors = [1, 2, 1_000, 1_000_000];
        let reward_divisors = [1, 2, 1_000, 1_000_000];
        let paid_values = [0, 1, 1_000_000_000];

        for share_divisor in share_divisors {
            for reward_divisor in reward_divisors {
                for reward_per_token_paid in paid_values {
                    let shares = i128::MAX / share_divisor;
                    let reward_per_token_stored = i128::MAX / reward_divisor;
                    let expected = shares
                        .checked_mul(reward_per_token_stored)
                        .and_then(|scaled_rewards| scaled_rewards.checked_div(PRECISION))
                        .and_then(|gross_rewards| gross_rewards.checked_sub(reward_per_token_paid));

                    assert_eq!(
                        checked_user_reward_delta(
                            shares,
                            reward_per_token_stored,
                            reward_per_token_paid,
                        ),
                        expected
                    );
                }
            }
        }
    }
}
