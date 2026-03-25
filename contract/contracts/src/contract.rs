use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Symbol};

use crate::storage::{StorageCache, *};
use crate::types::{Config, DataKey, Tier, UserInfo};

#[contract]
pub struct StakingContract;

const PRECISION: i128 = 1_000_000_000;
const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MOD_ROLE: Symbol = symbol_short!("MOD");

/// Reentrancy guard key
const REENTRANCY_GUARD: Symbol = symbol_short!("reentrant");

#[contractimpl]
impl StakingContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        staking_token: Address,
        reward_token: Address,
        reward_rate: i128,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&crate::types::DataKey::Config) {
            panic!("already initialized");
        }

        // Validate addresses
        Self::validate_address(&env, &admin);
        Self::validate_contract_address(&env, &staking_token);
        Self::validate_contract_address(&env, &reward_token);

        let config = Config {
            admin: admin.clone(),
            staking_token: staking_token.clone(),
            reward_token: reward_token.clone(),
            reward_rate,
        };
        write_config(&env, &config);
        write_last_update_time(&env, env.ledger().timestamp());
        env.storage().instance().set(&DataKey::Version, &1u32);

        // Grant initial admin role
        write_role(&env, ADMIN_ROLE, admin);

        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "initialized"), admin),
            (staking_token, reward_token, reward_rate),
        );
    }

    pub fn set_tier(env: Env, admin: Address, tier_id: u32, min_amount: i128, reward_multiplier: u32) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let tier = Tier {
            min_amount,
            reward_multiplier,
        };
        write_tier(&env, tier_id, &tier);
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "tier_set"), tier_id),
            (min_amount, reward_multiplier),
        );
    }

    pub fn stake(env: Env, user: Address, amount: i128, lock_duration: u64, tier_id: u32) {
        // Reentrancy protection
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);

        user.require_auth();
        if amount <= 0 {
            env.storage().instance().remove(&REENTRANCY_GUARD);
            panic!("amount must be > 0");
        }

        update_reward(&env, Some(&user));

        // Use StorageCache for efficient storage access
        let mut cache = StorageCache::new();
        let config = cache.get_config(&env).clone();
        let tier = read_tier(&env, tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });
        let mut total_shares = cache.get_total_shares(&env);
        let reward_per_token_stored = cache.get_reward_per_token_stored(&env);

        // Transfer staking tokens from user to contract with error handling
        let token_client = token::Client::new(&env, &config.staking_token);
        let contract_address = env.current_contract_address();
        
        match token_client.try_transfer(&user, &contract_address, &amount) {
            Ok(Ok(())) => {
                env.events().publish((symbol_short!("stake_transfer_success"),), amount);
            },
            _ => {
                env.storage().instance().remove(&REENTRANCY_GUARD);
                env.events().publish((symbol_short!("stake_transfer_failed"),), amount);
                panic!("token transfer failed");
            }
        }

        let mut user_info = read_user_info(&env, &user).unwrap_or(UserInfo {
            amount: 0,
            shares: 0,
            reward_per_token_paid: reward_per_token_stored,
            rewards: 0,
            lock_start_time: 0,
            lock_duration: 0,
            tier_id: 0,
        });

        // Update amount
        user_info.amount += amount;

        // Verify tier (using cached tier)
        if user_info.amount < tier.min_amount {
            env.storage().instance().remove(&REENTRANCY_GUARD);
            panic!("insufficient amount for tier");
        }

        // Boosting for long-term stakers: extra multiplier based on duration
        // E.g., every 30 days (2,592,000s) adds 10% to multiplier
        let boost = (lock_duration as u32 / 2_592_000) * 10;
        let total_multiplier = tier.reward_multiplier + boost;

        let new_shares = (user_info.amount * total_multiplier as i128) / 100;
        let diff_shares = new_shares - user_info.shares;

        user_info.shares = new_shares;
        user_info.tier_id = tier_id;

        // Update lock if they are staking more
        user_info.lock_start_time = env.ledger().timestamp();
        user_info.lock_duration = lock_duration;

        write_user_info(&env, &user, &user_info);

        // Update cached total_shares and write once
        total_shares += diff_shares;
        cache.set_total_shares(total_shares);
        write_total_shares(&env, total_shares);

        env.storage().instance().remove(&REENTRANCY_GUARD);
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "staked"), user),
            (amount, lock_duration, tier_id),
        );
    }

    pub fn claim(env: Env, user: Address, compound: bool) {
        // Reentrancy protection
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);

        user.require_auth();
        update_reward(&env, Some(&user));

        // Cache frequently accessed storage values
        let config = read_config(&env);
        let mut total_shares = read_total_shares(&env);

        let mut user_info = read_user_info(&env, &user).expect("user not found");
        let reward = user_info.rewards;

        if reward > 0 {
            user_info.rewards = 0;
            write_user_info(&env, &user, &user_info);

            let reward_token = token::Client::new(&env, &config.reward_token);

            if compound {
                // To compound, we would stake the reward. But reward token and staking token might differ.
                // Assuming they are the same for compounding to work seamlessly, or they trade them if we had a dex.
                if config.staking_token != config.reward_token {
                    env.storage().instance().remove(&REENTRANCY_GUARD);
                    panic!("cannot compound: reward token differs from staking token");
                }

                // Keep the reward in contract, just update shares and total shares
                // Cache tier read
                let tier = read_tier(&env, user_info.tier_id).unwrap_or(Tier {
                    min_amount: 0,
                    reward_multiplier: 100,
                });
                let boost = (user_info.lock_duration as u32 / 2_592_000) * 10;
                let total_multiplier = tier.reward_multiplier + boost;

                user_info.amount += reward;
                let new_shares = (user_info.amount * total_multiplier as i128) / 100;
                let diff_shares = new_shares - user_info.shares;

                user_info.shares = new_shares;
                write_user_info(&env, &user, &user_info);

                // Update cached total_shares and write once
                total_shares += diff_shares;
                write_total_shares(&env, total_shares);
            } else {
                match reward_token.try_transfer(&env.current_contract_address(), &user, &reward) {
                    Ok(Ok(())) => {
                        env.events().publish((symbol_short!("claim_transfer_success"),), reward);
                    },
                    _ => {
                        env.storage().instance().remove(&REENTRANCY_GUARD);
                        env.events().publish((symbol_short!("claim_transfer_failed"),), reward);
                        panic!("reward transfer failed");
                    }
                }
            }
        }

        env.storage().instance().remove(&REENTRANCY_GUARD);
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "claimed"), user),
            (reward, if compound { 1u32 } else { 0u32 }),
        );
    }

    pub fn unstake(env: Env, user: Address, amount: i128) {
        // Reentrancy protection
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);

        user.require_auth();
        if amount <= 0 {
            env.storage().instance().remove(&REENTRANCY_GUARD);
            panic!("amount must be > 0");
        }

        update_reward(&env, Some(&user));

        // Cache frequently accessed storage values
        let config = read_config(&env);
        let mut total_shares = read_total_shares(&env);

        let mut user_info = read_user_info(&env, &user).expect("user not found");
        if user_info.amount < amount {
            env.storage().instance().remove(&REENTRANCY_GUARD);
            panic!("insufficient balance");
        }

        let mut actual_amount = amount;
        let current_time = env.ledger().timestamp();

        // Early withdrawal penalty
        if current_time < user_info.lock_start_time + user_info.lock_duration {
            // Apply 20% penalty
            let penalty = (amount * 20) / 100;
            actual_amount = amount - penalty;
            // Penalty remains in contract or burned, here we just don't send it to the user.
        }

        user_info.amount -= amount;

        // Cache tier reads to avoid redundant storage access
        let tier = read_tier(&env, user_info.tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });
        if user_info.amount > 0 && user_info.amount < tier.min_amount {
            // Drop to base multiplier
            user_info.tier_id = 0;
        }

        let new_tier = read_tier(&env, user_info.tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });
        let boost = (user_info.lock_duration as u32 / 2_592_000) * 10;
        let total_multiplier = new_tier.reward_multiplier + boost;

        let new_shares = (user_info.amount * total_multiplier as i128) / 100;
        let diff_shares = user_info.shares - new_shares;
        user_info.shares = new_shares;

        write_user_info(&env, &user, &user_info);

        // Update cached total_shares and write once
        total_shares -= diff_shares;
        write_total_shares(&env, total_shares);

        let token_client = token::Client::new(&env, &config.staking_token);
        match token_client.try_transfer(&env.current_contract_address(), &user, &actual_amount) {
            Ok(Ok(())) => {
                env.events().publish((symbol_short!("unstake_transfer_success"),), actual_amount);
            },
            _ => {
                env.storage().instance().remove(&REENTRANCY_GUARD);
                env.events().publish((symbol_short!("unstake_transfer_failed"),), actual_amount);
                panic!("unstake transfer failed");
            }
        }

        env.storage().instance().remove(&REENTRANCY_GUARD);
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "unstaked"), user),
            (amount, actual_amount),
        );
    }

    pub fn slash(env: Env, admin: Address, user: Address, amount: i128) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        update_reward(&env, Some(&user));

        // Cache frequently accessed storage values
        let mut total_shares = read_total_shares(&env);

        let mut user_info = read_user_info(&env, &user).expect("user not found");
        if user_info.amount < amount {
            panic!("slash amount exceeds balance");
        }

        user_info.amount -= amount;

        // Cache tier reads to avoid redundant storage access
        let tier = read_tier(&env, user_info.tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });
        if user_info.amount > 0 && user_info.amount < tier.min_amount {
            user_info.tier_id = 0;
        }

        let new_tier = read_tier(&env, user_info.tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });
        let boost = (user_info.lock_duration as u32 / 2_592_000) * 10;
        let total_multiplier = new_tier.reward_multiplier + boost;

        let new_shares = (user_info.amount * total_multiplier as i128) / 100;
        let diff_shares = user_info.shares - new_shares;
        user_info.shares = new_shares;

        write_user_info(&env, &user, &user_info);

        // Update cached total_shares and write once
        total_shares -= diff_shares;
        write_total_shares(&env, total_shares);

        // Slashed tokens stay in contract or could be burned.
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "slashed"), user),
            amount,
        );
    }

    pub fn emergency_withdraw(env: Env, user: Address) {
        user.require_auth();

        // Skips reward update! Just get funds out minus 20% penalty.
        let user_info = read_user_info(&env, &user).expect("user not found");
        let amount = user_info.amount;
        if amount == 0 {
            panic!("no balance");
        }

        let penalty = (amount * 20) / 100;
        let actual_amount = amount - penalty;

        let config = read_config(&env);
        let token_client = token::Client::new(&env, &config.staking_token);

        let mut total_shares = read_total_shares(&env);
        total_shares -= user_info.shares;
        write_total_shares(&env, total_shares);

        let empty_info = UserInfo {
            amount: 0,
            shares: 0,
            reward_per_token_paid: 0,
            rewards: 0,
            lock_start_time: 0,
            lock_duration: 0,
            tier_id: 0,
        };
        write_user_info(&env, &user, &empty_info);

        token_client.transfer(&env.current_contract_address(), &user, &actual_amount);
        extend_instance(&env);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "emergency_withdrawn"), user),
            (amount, actual_amount),
        );
    }

    // --- UPGRADEABILITY MECHANISMS ---
    // Schedule an upgrade with a timelock (e.g., 24 hours).
    pub fn schedule_upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>, unlock_time: u64) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        if env.ledger().timestamp() >= unlock_time {
            panic!("unlock_time must be in the future");
        }

        env.storage().instance().set(
            &DataKey::UpgradeTimelock,
            &(new_wasm_hash.clone(), unlock_time),
        );

        env.events().publish(
            (Symbol::new(&env, "UpgradeScheduled"),),
            (new_wasm_hash, unlock_time),
        );
        extend_instance(&env);
    }

    // Cancel a scheduled upgrade. (Rollback mechanism before execution)
    pub fn cancel_upgrade(env: Env, admin: Address) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        env.storage().instance().remove(&DataKey::UpgradeTimelock);
        env.events()
            .publish((Symbol::new(&env, "UpgradeCancelled"),), ());
        extend_instance(&env);
    }

    // Execute the scheduled upgrade.
    pub fn execute_upgrade(env: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let (scheduled_hash, unlock_time): (BytesN<32>, u64) = env
            .storage()
            .instance()
            .get(&DataKey::UpgradeTimelock)
            .unwrap_or_else(|| panic!("no upgrade scheduled"));

        if scheduled_hash != new_wasm_hash {
            panic!("wasm hash does not match scheduled");
        }
        if env.ledger().timestamp() < unlock_time {
            panic!("timelock not expired");
        }

        // Clear the timelock so it can't be reused
        env.storage().instance().remove(&DataKey::UpgradeTimelock);

        // Perform the upgrade
        env.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        env.events()
            .publish((Symbol::new(&env, "Upgraded"),), new_wasm_hash);
    }

    // Execute a state migration after an upgrade.
    pub fn migrate_state(env: Env, admin: Address, new_version: u32) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let current_version: u32 = env.storage().instance().get(&DataKey::Version).unwrap_or(1);
        if new_version <= current_version {
            panic!("new_version must be > current_version");
        }

        // State migration logic goes here...
        // e.g., if current_version < 2 { migrate_v1_to_v2(&env); }

        env.storage()
            .instance()
            .set(&DataKey::Version, &new_version);
        env.events().publish(
            (Symbol::new(&env, "StateMigrated"),),
            (current_version, new_version),
        );
        extend_instance(&env);
    }

    // Get current contract version
    pub fn version(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Role Management
    pub fn grant_role(env: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        write_role(&env, role, address);
    }

    pub fn revoke_role(env: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !has_role(&env, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        remove_role(&env, role, address);
    }

    pub fn has_role(env: Env, role: Symbol, address: Address) -> bool {
        has_role(&env, role, address)
    }
}

fn update_reward(env: &Env, user: Option<&Address>) {
    let config = read_config(env);
    let mut rpt_stored = read_reward_per_token_stored(env);
    let last_update_time = read_last_update_time(env);
    let current_time = env.ledger().timestamp();

    if current_time > last_update_time {
        let total_shares = read_total_shares(env);
        if total_shares > 0 {
            let time_diff = (current_time - last_update_time) as i128;
            let reward = time_diff * config.reward_rate;
            rpt_stored += (reward * PRECISION) / total_shares;
        }
        write_reward_per_token_stored(env, rpt_stored);
        write_last_update_time(env, current_time);
    }

    if let Some(u) = user {
        let mut user_info = read_user_info(env, u).unwrap_or(UserInfo {
            amount: 0,
            shares: 0,
            reward_per_token_paid: rpt_stored,
            rewards: 0,
            lock_start_time: 0,
            lock_duration: 0,
            tier_id: 0,
        });

        let pending =
            (user_info.shares * (rpt_stored - user_info.reward_per_token_paid)) / PRECISION;
        user_info.rewards += pending;
        user_info.reward_per_token_paid = rpt_stored;
        write_user_info(env, u, &user_info);
    }
}

/// Validates that an address is not zero
fn validate_address(env: &Env, address: &Address) {
    // Check if address is zero
    if address == &Address::from_contract_id(&BytesN::from_array(env, &[0; 32])) {
        panic!("zero address not allowed");
    }
}

/// Validates that an address points to a deployed token contract
fn validate_contract_address(env: &Env, address: &Address) {
    validate_address(env, address);
    // Try to call a token interface method to verify it's a token contract
    let token_client = token::Client::new(env, address);
    // This will fail if not a valid token contract
    let _ = token_client.decimals();
}
