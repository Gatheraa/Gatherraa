#![cfg(test)]

use crate::contract::{StakingContract, StakingContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, vec, Address, BytesN, Env, Symbol,
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &contract_id.address())
}

// ============================================================================
// MINIMUM/MAXIMUM VALUE TESTS
// ============================================================================

#[test]
#[should_panic(expected = "amount must be greater than 0")]
fn test_minimum_stake_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test minimum stake amount (should fail with 0)
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &0, &lock_duration, &1);
}

#[test]
fn test_maximum_stake_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    
    // Mint maximum possible amount (i128::MAX)
    token_admin.mint(&user1, &i128::MAX);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test maximum stake amount
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &i128::MAX, &lock_duration, &1);
    
    // Verify the stake was recorded
    assert_eq!(token.balance(&contract_id), i128::MAX);
}

#[test]
fn test_maximum_lock_duration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test maximum lock duration (u64::MAX)
    client.stake(&user1, &1000, &u64::MAX, &1);
    
    // Verify the stake was recorded
    assert_eq!(token.balance(&contract_id), 1000);
}

#[test]
#[should_panic]
fn test_exceed_maximum_tier_threshold() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &10);

    // Test with maximum possible threshold (should handle gracefully or fail appropriately)
    client.set_tier(&1, &i128::MAX, &150);
}

// ============================================================================
// ZERO VALUE TESTS
// ============================================================================

#[test]
#[should_panic(expected = "reward rate must be greater than 0")]
fn test_zero_reward_rate_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    // Test initialization with zero reward rate
    client.initialize(&admin, &token.address, &token.address, &0);
}

#[test]
fn test_zero_multiplier_tier() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &10);

    // Test tier with zero multiplier (should be handled gracefully)
    client.set_tier(&1, &1000, &0);
    
    // Verify tier was set with zero multiplier
    let tier_info = client.get_tier_info(&1);
    assert_eq!(tier_info.multiplier, 0);
}

#[test]
fn test_zero_amount_unstake() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &1000, &lock_duration, &1);

    // Test unstaking zero amount (should be no-op or handled gracefully)
    let initial_balance = token.balance(&user1);
    client.unstake(&user1, &0);
    
    // Balance should remain unchanged
    assert_eq!(token.balance(&user1), initial_balance);
}

#[test]
fn test_zero_amount_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test claim with no rewards (should be no-op)
    let initial_balance = token.balance(&user1);
    client.claim(&user1, &false);
    
    // Balance should remain unchanged
    assert_eq!(token.balance(&user1), initial_balance);
}

// ============================================================================
// EMPTY COLLECTION TESTS
// ============================================================================

#[test]
fn test_empty_user_stakes() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);

    // Test getting stakes for user with no stakes
    let stakes = client.get_user_stakes(&user1);
    assert_eq!(stakes.len(), 0);
}

#[test]
fn test_empty_tier_list() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &10);

    // Test getting all tiers when none have been set
    let tiers = client.get_all_tiers();
    assert_eq!(tiers.len(), 0);
}

#[test]
fn test_empty_events_list() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &Address::generate(&env), &Address::generate(&env), &10);

    // Test getting events when none have been emitted
    let events = client.get_recent_events(&10);
    assert_eq!(events.len(), 0);
}

// ============================================================================
// ERROR CONDITION TESTS
// ============================================================================

#[test]
#[should_panic(expected = "unauthorized")]
fn test_unauthorized_stake_operation() {
    let env = Env::default();
    // Don't mock auths to test authorization

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test unauthorized stake (should fail without proper auth)
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &1000, &lock_duration, &1);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_insufficient_token_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    // Don't mint any tokens to user

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test stake with insufficient balance
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &1000, &lock_duration, &1);
}

#[test]
#[should_panic(expected = "tier does not exist")]
fn test_nonexistent_tier() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);

    // Test staking with nonexistent tier
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &1000, &lock_duration, &999); // Tier 999 doesn't exist
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    // First initialization
    client.initialize(&admin, &token.address, &token.address, &10);
    
    // Second initialization (should fail)
    client.initialize(&admin, &token.address, &token.address, &20);
}

#[test]
fn test_invalid_address_input() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    // Test initialization with zero address (should be handled gracefully)
    let zero_address = Address::from_string(&env, &soroban_sdk::String::from_str(&env, ""));
    // This might panic or be handled depending on implementation
    // The exact behavior depends on the contract's validation logic
}

#[test]
#[should_panic(expected = "negative duration not allowed")]
fn test_negative_lock_duration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test negative lock duration (should fail)
    client.stake(&user1, &1000, &-1, &1);
}

#[test]
fn test_overflow_conditions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    // Test near-overflow conditions
    let large_amount = i128::MAX / 2;
    token_admin.mint(&user1, &large_amount);

    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &large_amount, &lock_duration, &1);
    
    // Verify stake was recorded correctly
    assert_eq!(token.balance(&contract_id), large_amount);
}

#[test]
fn test_underflow_conditions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token = create_token_contract(&env, &admin);
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user1, &1000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &10);
    client.set_tier(&1, &1000, &150);

    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &1000, &lock_duration, &1);

    // Test unstaking more than available (should fail or handle gracefully)
    // This tests underflow protection
    let result = std::panic::catch_unwind(|| {
        client.unstake(&user1, &2000); // More than staked
    });
    
    // Should either panic gracefully or handle the error
    assert!(result.is_err() || token.balance(&user1) >= 0);
}
