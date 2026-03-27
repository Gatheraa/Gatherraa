#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token, Address, Env, String, Vec,
};

fn create_token_contract<'a>(e: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    token::StellarAssetClient::new(e, &e.register_stellar_asset_contract_v2(admin.clone()).address())
}

fn create_subscription_contract<'a>(e: &Env) -> SubscriptionContractClient<'a> {
    SubscriptionContractClient::new(e, &e.register(SubscriptionContract, ()))
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    contract.initialize(&admin, &token.address, &7);

    // Verify initialization
    assert!(contract.get_plan(&1).is_none());
}

#[test]
fn test_create_plan() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    assert_eq!(plan_id, 1);

    let plan = contract.get_plan(&plan_id).unwrap();
    assert_eq!(plan.price, 1000);
    assert_eq!(plan.duration_days, 30);
    assert_eq!(plan.max_family_members, 5);
}

#[test]
fn test_subscribe() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    // Mint tokens to user
    token.mint(&user, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    let subscription_id = contract.subscribe(&user, &plan_id);

    assert_eq!(subscription_id, 1);

    let subscription = contract.get_subscription(&user).unwrap();
    assert_eq!(subscription.plan_id, plan_id);
    assert_eq!(subscription.status, SubscriptionStatus::Active);
    assert_eq!(subscription.auto_renew, true);
}

#[test]
fn test_cancel_subscription_with_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    // Mint tokens
    token.mint(&user, &10000);
    token.mint(&admin, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);

    let initial_balance = token.balance(&user);

    // Advance time by 15 days (half the subscription period)
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 15 * 86400,
        protocol_version: 20,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 365 * 86400,
    });

    contract.cancel_subscription(&user);

    let subscription = contract.get_subscription(&user).unwrap();
    assert_eq!(subscription.status, SubscriptionStatus::Cancelled);

    // User should receive approximately half refund
    let final_balance = token.balance(&user);
    assert!(final_balance > initial_balance);
}

#[test]
fn test_pause_and_resume_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);

    // Pause subscription
    contract.pause_subscription(&user);

    let subscription = contract.get_subscription(&user).unwrap();
    assert_eq!(subscription.status, SubscriptionStatus::Paused);

    // Resume subscription
    contract.resume_subscription(&user);

    let subscription = contract.get_subscription(&user).unwrap();
    assert_eq!(subscription.status, SubscriptionStatus::Active);
}

#[test]
fn test_upgrade_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &20000);
    token.mint(&admin, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let monthly_plan = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    let annual_category_ids = Vec::from_array(&env, [1, 2, 3, 4, 5]);
    let annual_plan = contract.create_plan(
        &SubscriptionTier::Annual,
        &10000,
        &365,
        &annual_category_ids,
        &10,
    );

    contract.subscribe(&user, &monthly_plan);

    // Upgrade to annual plan
    contract.change_plan(&user, &annual_plan);

    let subscription = contract.get_subscription(&user).unwrap();
    assert_eq!(subscription.plan_id, annual_plan);
}

#[test]
fn test_family_plan() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let member1 = Address::generate(&env);
    let member2 = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&owner, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&owner, &plan_id);

    // Add family members
    contract.add_family_member(&owner, &member1);
    contract.add_family_member(&owner, &member2);

    let subscription = contract.get_subscription(&owner).unwrap();
    assert_eq!(subscription.is_family_plan, true);
    assert_eq!(subscription.family_members.len(), 2);

    // Remove a family member
    contract.remove_family_member(&owner, &member1);

    let subscription = contract.get_subscription(&owner).unwrap();
    assert_eq!(subscription.family_members.len(), 1);
}

#[test]
fn test_gift_subscription() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let gifter = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&gifter, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    // Gift subscription
    let gift_id = contract.gift_subscription(&gifter, &recipient, &plan_id);

    // Recipient claims gift
    let subscription_id = contract.claim_gift(&recipient, &gift_id);

    let subscription = contract.get_subscription(&recipient).unwrap();
    assert_eq!(subscription.subscription_id, subscription_id);
    assert_eq!(subscription.plan_id, plan_id);
    assert_eq!(subscription.auto_renew, false); // Gifted subscriptions don't auto-renew
}

#[test]
fn test_auto_renew() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &20000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);

    let subscription = contract.get_subscription(&user).unwrap();
    let original_end_date = subscription.end_date;

    // Advance time past subscription end
    env.ledger().set(LedgerInfo {
        timestamp: original_end_date + 1,
        protocol_version: 20,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 365 * 86400,
    });

    // Renew subscription
    contract.renew_subscription(&user);

    let subscription = contract.get_subscription(&user).unwrap();
    assert!(subscription.end_date > original_end_date);
    assert_eq!(subscription.status, SubscriptionStatus::Active);
}

#[test]
fn test_grace_period() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);

    let subscription = contract.get_subscription(&user).unwrap();
    let end_date = subscription.end_date;

    // Advance time past subscription end but within grace period
    env.ledger().set(LedgerInfo {
        timestamp: end_date + 3 * 86400, // 3 days after expiry
        protocol_version: 20,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 365 * 86400,
    });

    let status = contract.check_subscription_status(&user);
    assert_eq!(status, SubscriptionStatus::GracePeriod);
}

#[test]
fn test_category_access() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &10000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);

    // User should have access to categories 1, 2, 3
    assert!(contract.has_category_access(&user, &1));
    assert!(contract.has_category_access(&user, &2));
    assert!(contract.has_category_access(&user, &3));
    
    // User should not have access to category 4
    assert!(!contract.has_category_access(&user, &4));
}

#[test]
#[should_panic(expected = "User already has an active subscription")]
fn test_cannot_subscribe_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &20000);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    contract.subscribe(&user, &plan_id);
    contract.subscribe(&user, &plan_id); // Should panic
}

#[test]
fn test_update_plan() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1, 2, 3]);
    let plan_id = contract.create_plan(
        &SubscriptionTier::Monthly,
        &1000,
        &30,
        &category_ids,
        &5,
    );

    let new_category_ids = Vec::from_array(&env, [1, 2, 3, 4, 5]);
    contract.update_plan(&plan_id, &1500, &new_category_ids, &true);

    let plan = contract.get_plan(&plan_id).unwrap();
    assert_eq!(plan.price, 1500);
    assert_eq!(plan.category_ids.len(), 5);
}

// ─── Tests for refactored helpers ─────────────────────────────────────────────────────

#[test]
fn test_subscribe_duplicate_blocks() {
    // Subscribing twice while already active must panic.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &20000);
    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1u32]);
    let plan_id = contract.create_plan(&SubscriptionTier::Monthly, &1000, &30, &category_ids, &0);

    contract.subscribe(&user, &plan_id);

    // Second subscribe should panic
    let result = std::panic::catch_unwind(|| {
        contract.subscribe(&user, &plan_id);
    });
    assert!(result.is_err(), "Subscribing twice should fail");
}

#[test]
fn test_claim_gift_sets_auto_renew_false() {
    // Gifts should create subscriptions with auto_renew = false.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let gifter = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&gifter, &10000);
    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1u32]);
    let plan_id = contract.create_plan(&SubscriptionTier::Monthly, &1000, &30, &category_ids, &0);

    let gift_id = contract.gift_subscription(&gifter, &recipient, &plan_id);
    let sub_id = contract.claim_gift(&recipient, &gift_id);

    let sub = contract.get_subscription(&recipient).unwrap();
    assert_eq!(sub.subscription_id, sub_id);
    assert!(!sub.auto_renew, "Gifted subscription should have auto_renew = false");
    assert_eq!(sub.status, SubscriptionStatus::Active);
}

#[test]
fn test_check_subscription_status_expires_to_grace() {
    // When a subscription passes end_date but not grace period end, it should become GracePeriod.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &10000);
    // 7-day grace period
    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1u32]);
    // 30-day plan
    let plan_id = contract.create_plan(&SubscriptionTier::Monthly, &1000, &30, &category_ids, &0);
    contract.subscribe(&user, &plan_id);

    // Advance ledger past end_date but within grace period (35 days = 30 plan + 5 days into grace)
    let thirty_five_days = 35u64 * 86_400;
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + thirty_five_days,
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 100,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 10000,
        min_persistent_entry_ttl: 10000,
        min_temp_entry_ttl: 10000,
    });

    let status = contract.check_subscription_status(&user);
    assert_eq!(status, SubscriptionStatus::GracePeriod);
}

#[test]
fn test_check_subscription_status_expires_fully() {
    // Past grace period -> Expired.
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let contract = create_subscription_contract(&env);

    token.mint(&user, &10000);
    contract.initialize(&admin, &token.address, &7);

    let category_ids = Vec::from_array(&env, [1u32]);
    let plan_id = contract.create_plan(&SubscriptionTier::Monthly, &1000, &30, &category_ids, &0);
    contract.subscribe(&user, &plan_id);

    // Advance 40 days (30 plan + 7 grace + 3 extra)
    let forty_days = 40u64 * 86_400;
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + forty_days,
        protocol_version: 21,
        sequence_number: env.ledger().sequence() + 100,
        network_id: [0u8; 32],
        base_reserve: 10,
        max_entry_ttl: 10000,
        min_persistent_entry_ttl: 10000,
        min_temp_entry_ttl: 10000,
    });

    let status = contract.check_subscription_status(&user);
    assert_eq!(status, SubscriptionStatus::Expired);
}
