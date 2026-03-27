#![cfg(test)]

use crate::contract::{StakingContract, StakingContractClient};
use crate::error::StakingError;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, vec, Address, BytesN, Env, Symbol,
};
use soroban_sdk::symbol_short;

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &contract_id.address())
}

fn setup_contract(env: &Env, admin: &Address, user: &Address) -> (token::Client<'_>, StakingContractClient<'_>) {
    let token = create_token_contract(env, admin);
    let token_admin = token::StellarAssetClient::new(env, &token.address);
    token_admin.mint(user, &10_000_000);

    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(env, &contract_id);
    
    client.initialize(admin, &token.address, &token.address, &1000);
    (token, client)
}

#[test]
fn test_staking_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let (token, client) = setup_contract(&env, &admin, &user1);

    client.set_tier(&admin, &1, &1000, &150);

    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &2000, &lock_duration, &1);

    assert_eq!(token.balance(&user1), 10_000_000 - 2000);
    assert_eq!(token.balance(&client.address), 2000);

    let mut ledger = env.ledger().get();
    ledger.timestamp += 10;
    env.ledger().set(ledger);

    let expected_rewards = 10 * 1000 * 150 / 100;
    client.claim(&user1, &false);
    assert!(token.balance(&user1) > 10_000_000 - 2000);
}

#[test]
fn test_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    
    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &1000);
    
    assert_eq!(client.version(&env), 1);
    assert!(client.has_role(&symbol_short!("ADMIN"), &admin));
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token = create_token_contract(&env, &admin);
    
    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);

    client.initialize(&admin, &token.address, &token.address, &1000);
    
    let result = client.try_initialize(&admin, &token.address, &token.address, &1000);
    assert_eq!(result, Err(StakingError::AlreadyInitialized));
}

#[test]
fn test_set_tier_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_set_tier(&unauthorized, &1, &1000, &150);
    assert_eq!(result, Err(StakingError::Unauthorized));
}

#[test]
fn test_stake_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_stake(&user, &0, &30 * 24 * 60 * 60, &1);
    assert_eq!(result, Err(StakingError::AmountMustBePositive));
}

#[test]
fn test_stake_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_stake(&user, &20_000_000, &30 * 24 * 60 * 60, &1);
    assert_eq!(result, Err(StakingError::InsufficientBalance));
}

#[test]
fn test_stake_insufficient_tier_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);

    let result = client.try_stake(&user, &500, &30 * 24 * 60 * 60, &1);
    assert_eq!(result, Err(StakingError::InsufficientAmountForTier));
}

#[test]
fn test_claim_rewards_compound() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let mut ledger = env.ledger().get();
    ledger.timestamp += 10;
    env.ledger().set(ledger);

    let balance_before = token.balance(&user);
    client.claim(&user, &true);
    
    let user_info = client.user_info(&user);
    assert!(user_info.amount > 2000);
    assert_eq!(token.balance(&user), balance_before);
}

#[test]
fn test_claim_different_tokens_compound_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    let staking_token = create_token_contract(&env, &admin);
    let reward_token = create_token_contract(&env, &admin);
    
    let contract_id = env.register(StakingContract, ());
    let client = StakingContractClient::new(&env, &contract_id);
    
    client.initialize(&admin, &staking_token.address, &reward_token.address, &1000);
    
    let staking_admin = staking_token::StellarAssetClient::new(&env, &staking_token.address);
    staking_admin.mint(&user, &10_000_000);
    
    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let mut ledger = env.ledger().get();
    ledger.timestamp += 10;
    env.ledger().set(ledger);

    let result = client.try_claim(&user, &true);
    assert_eq!(result, Err(StakingError::RewardTokenDiffers));
}

#[test]
fn test_unstake_before_lock_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let balance_before = token.balance(&user);
    client.unstake(&user, &1000);
    
    let expected_withdrawal = 1000 - (1000 * 20 / 100);
    assert_eq!(token.balance(&user), balance_before + expected_withdrawal);
}

#[test]
fn test_unstake_after_lock_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let mut ledger = env.ledger().get();
    ledger.timestamp += lock_duration + 1;
    env.ledger().set(ledger);

    let balance_before = token.balance(&user);
    client.unstake(&user, &1000);
    
    assert_eq!(token.balance(&user), balance_before + 1000);
}

#[test]
fn test_unstake_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let result = client.try_unstake(&user, &3000);
    assert_eq!(result, Err(StakingError::InsufficientBalance));
}

#[test]
fn test_unstake_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let result = client.try_unstake(&user, &0);
    assert_eq!(result, Err(StakingError::AmountMustBePositive));
}

#[test]
fn test_unstake_user_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_unstake(&user, &1000);
    assert_eq!(result, Err(StakingError::UserNotFound));
}

#[test]
fn test_slash_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let result = client.try_slash(&unauthorized, &user, &1000);
    assert_eq!(result, Err(StakingError::Unauthorized));
}

#[test]
fn test_slash_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    client.slash(&admin, &user, &1000);
    
    let user_info = client.user_info(&user);
    assert_eq!(user_info.amount, 1000);
}

#[test]
fn test_slash_amount_exceeds_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let result = client.try_slash(&admin, &user, &3000);
    assert_eq!(result, Err(StakingError::SlashingAmountExceedsBalance));
}

#[test]
fn test_emergency_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let balance_before = token.balance(&user);
    client.emergency_withdraw(&user);
    
    let expected_withdrawal = 2000 - (2000 * 20 / 100);
    assert_eq!(token.balance(&user), balance_before + expected_withdrawal);
    
    let user_info = client.user_info(&user);
    assert_eq!(user_info.amount, 0);
    assert_eq!(user_info.shares, 0);
}

#[test]
fn test_emergency_withdraw_no_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_emergency_withdraw(&user);
    assert_eq!(result, Err(StakingError::InsufficientBalance));
}

#[test]
fn test_role_management() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let moderator = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.grant_role(&admin, &symbol_short!("MOD"), &moderator);
    assert!(client.has_role(&symbol_short!("MOD"), &moderator));

    client.revoke_role(&admin, &symbol_short!("MOD"), &moderator);
    assert!(!client.has_role(&symbol_short!("MOD"), &moderator));
}

#[test]
fn test_role_grant_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let moderator = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_grant_role(&unauthorized, &symbol_short!("MOD"), &moderator);
    assert_eq!(result, Err(StakingError::Unauthorized));
}

#[test]
fn test_upgrade_management() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let new_wasm_hash = BytesN::from_array(&env, &[1; 32]);
    let unlock_time = env.ledger().timestamp() + 1000;
    
    client.schedule_upgrade(&admin, &new_wasm_hash, &unlock_time);
    client.cancel_upgrade(&admin);
    
    let mut ledger = env.ledger().get();
    ledger.timestamp = unlock_time + 1;
    env.ledger().set(ledger);
    
    client.execute_upgrade(&admin, &new_wasm_hash);
}

#[test]
fn test_state_migration() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    assert_eq!(client.version(&env), 1);
    
    client.migrate_state(&admin, &2);
    assert_eq!(client.version(&env), 2);
}

#[test]
fn test_state_migration_invalid_version() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    let result = client.try_migrate_state(&admin, &1);
    assert_eq!(result, Err(StakingError::NewVersionMustBeGreater));
}

#[test]
fn test_multiple_users_staking() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user1);

    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&user2, &10_000_000);

    client.set_tier(&admin, &1, &1000, &150);
    
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user1, &2000, &lock_duration, &1);
    client.stake(&user2, &3000, &lock_duration, &1);

    assert_eq!(token.balance(&client.address), 5000);
    
    let user1_info = client.user_info(&user1);
    let user2_info = client.user_info(&user2);
    assert!(user1_info.shares > 0);
    assert!(user2_info.shares > 0);
}

#[test]
fn test_tier_downgrade_on_unstake() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    client.set_tier(&admin, &2, &500, &120);
    
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let user_info_before = client.user_info(&user);
    assert_eq!(user_info_before.tier_id, 1);

    client.unstake(&user, &1500);
    
    let user_info_after = client.user_info(&user);
    assert_eq!(user_info_after.tier_id, 2);
}

#[test]
fn test_edge_case_zero_total_shares() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    client.unstake(&user, &2000);

    let mut ledger = env.ledger().get();
    ledger.timestamp += 10;
    env.ledger().set(ledger);

    client.claim(&user, &false);
}

#[test]
fn test_reward_calculation_accuracy() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    client.stake(&user, &2000, &lock_duration, &1);

    let mut ledger = env.ledger().get();
    ledger.timestamp += 100;
    env.ledger().set(ledger);

    let balance_before = token.balance(&user);
    client.claim(&user, &false);
    
    let expected_rewards = 100 * 1000 * 150 / 100;
    assert!(token.balance(&user) >= balance_before + expected_rewards - 1);
}

#[test]
fn test_reentrancy_protection() {
    let env = Env::default();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let (token, client) = setup_contract(&env, &admin, &user);

    client.set_tier(&admin, &1, &1000, &150);
    let lock_duration = 30 * 24 * 60 * 60;
    
    env.mock_auths(&[
        (&user, &client.address, &symbol_short!("stake"), &vec![&env, &user, &2000i128, &lock_duration, &1u32])
    ]);
    
    client.stake(&user, &2000, &lock_duration, &1);
}
