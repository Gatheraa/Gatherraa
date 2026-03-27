use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, Symbol, Vec,
};
use soroban_sdk::symbol_short;
use crate::{
    EscrowContract, EscrowStatus, Escrow, RevenueSplit, Milestone, RevenueSplitConfig, 
    ReferralTracker, Dispute, DisputeResolution, EscrowError
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &contract_id.address())
}

fn create_test_config() -> RevenueSplitConfig {
    RevenueSplitConfig {
        default_organizer_percentage: 8000000, // 80%
        default_platform_percentage: 1500000,  // 15%
        default_referral_percentage: 500000,   // 5%
        max_referral_percentage: 10000000,     // 100%
        precision: 10000000,                   // 7 decimal places
        min_escrow_amount: 1000000,            // 0.1 XLM
        max_escrow_amount: 10000000000,        // 1000 XLM
        dispute_timeout: 86400,                // 24 hours
        emergency_withdrawal_delay: 3600,       // 1 hour
    }
}

fn setup_escrow_contract(env: &Env) -> (Address, token::Client<'_>) {
    let admin = Address::generate(env);
    let token = create_token_contract(env, &admin);
    
    EscrowContract::initialize(env.clone(), admin.clone(), create_test_config());
    
    (admin, token)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let config = create_test_config();

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let stored_config = EscrowContract::get_config(env.clone());
    assert_eq!(stored_config.default_organizer_percentage, config.default_organizer_percentage);
    assert_eq!(stored_config.default_platform_percentage, config.default_platform_percentage);
    assert_eq!(stored_config.default_referral_percentage, config.default_referral_percentage);
    
    assert_eq!(EscrowContract::version(env), 1);
    assert!(!EscrowContract::is_paused(env));
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let config = create_test_config();

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    env.mock_all_auths();
    let result = std::panic::catch_unwind(|| {
        EscrowContract::initialize(env, admin, config);
    });
    assert!(result.is_err());
}

#[test]
fn test_create_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000, // 0.5 XLM
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id.clone());
    assert_eq!(escrow.event, event);
    assert_eq!(escrow.organizer, organizer);
    assert_eq!(escrow.purchaser, purchaser);
    assert_eq!(escrow.amount, 5000000);
    assert_eq!(escrow.status, EscrowStatus::Pending);
    
    let event_escrows = EscrowContract::get_event_escrows(env.clone(), event);
    assert_eq!(event_escrows.len(), 1);
    assert_eq!(event_escrows.get(0).unwrap(), escrow_id);
    
    let user_escrows = EscrowContract::get_user_escrows(env, purchaser);
    assert_eq!(user_escrows.len(), 1);
}

#[test]
fn test_create_escrow_with_custom_revenue_split() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let referral = Address::generate(&env);
    
    let custom_split = RevenueSplit {
        organizer_percentage: 7000000, // 70%
        platform_percentage: 2000000,  // 20%
        referral_percentage: 1000000,  // 10%
        precision: 10000000,
    };
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        Some(custom_split.clone()),
        Some(referral.clone()),
        None,
    );
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.revenue_splits.organizer_percentage, custom_split.organizer_percentage);
    assert_eq!(escrow.revenue_splits.platform_percentage, custom_split.platform_percentage);
    assert_eq!(escrow.revenue_splits.referral_percentage, custom_split.referral_percentage);
    assert_eq!(escrow.referral, Some(referral));
}

#[test]
fn test_create_escrow_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::create_escrow(
            env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            500000, // Below minimum
            token.address(),
            release_time,
            None,
            None,
            None,
        );
    });
    assert!(result.is_err());
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::create_escrow(
            env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            20000000000, // Above maximum
            token.address(),
            release_time,
            None,
            None,
            None,
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_create_escrow_with_milestones() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let milestones = Vec::from_array(&env, [
        Milestone {
            id: 1,
            description: soroban_sdk::String::from_str(&env, "First milestone"),
            amount: 2500000,
            completed: false,
        },
        Milestone {
            id: 2,
            description: soroban_sdk::String::from_str(&env, "Second milestone"),
            amount: 2500000,
            completed: false,
        },
    ]);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        Some(milestones.clone()),
    );
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.milestones.len(), 2);
    assert_eq!(escrow.milestones.get(0).unwrap().id, 1);
    assert_eq!(escrow.milestones.get(1).unwrap().id, 2);
}

#[test]
fn test_lock_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    let balance_before = token.balance(&purchaser);
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    assert_eq!(token.balance(&purchaser), balance_before - 5000000);
    assert_eq!(token.balance(&EscrowContract::address(env)), 5000000);
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Locked);
}

#[test]
fn test_lock_escrow_invalid_status() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::lock_escrow(env, escrow_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_release_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let platform = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let mut ledger = env.ledger().get();
    ledger.timestamp = release_time + 1;
    env.ledger().set(ledger);
    
    let organizer_balance_before = token.balance(&organizer);
    let platform_balance_before = token.balance(&platform);
    
    EscrowContract::release_escrow(env.clone(), escrow_id.clone());
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Released);
    
    assert!(token.balance(&organizer) > organizer_balance_before);
    assert!(token.balance(&platform) > platform_balance_before);
}

#[test]
fn test_release_escrow_before_time() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::release_escrow(env, escrow_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_create_dispute() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let dispute_reason = soroban_sdk::String::from_str(&env, "Service not delivered");
    EscrowContract::create_dispute(env.clone(), escrow_id.clone(), dispute_reason.clone());
    
    let escrow = EscrowContract::get_escrow(env, escrow_id.clone());
    assert!(escrow.dispute_active);
    
    let dispute = EscrowContract::get_dispute(env, escrow_id);
    assert_eq!(dispute.reason, dispute_reason);
    assert_eq!(dispute.created_by, purchaser);
}

#[test]
fn test_resolve_dispute() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let dispute_reason = soroban_sdk::String::from_str(&env, "Service not delivered");
    EscrowContract::create_dispute(env.clone(), escrow_id.clone(), dispute_reason);
    
    let resolution = DisputeResolution {
        refund_percentage: 5000000, // 50%
        favor_organizer: false,
        notes: soroban_sdk::String::from_str(&env, "Partial refund approved"),
    };
    
    let purchaser_balance_before = token.balance(&purchaser);
    EscrowContract::resolve_dispute(env.clone(), escrow_id.clone(), resolution.clone());
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Released);
    assert!(!escrow.dispute_active);
    
    let expected_refund = (5000000 * 5000000) / 10000000; // 50% of 5M
    assert!(token.balance(&purchaser) >= purchaser_balance_before + expected_refund - 1);
}

#[test]
fn test_complete_milestone() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let milestones = Vec::from_array(&env, [
        Milestone {
            id: 1,
            description: soroban_sdk::String::from_str(&env, "First milestone"),
            amount: 2500000,
            completed: false,
        },
        Milestone {
            id: 2,
            description: soroban_sdk::String::from_str(&env, "Second milestone"),
            amount: 2500000,
            completed: false,
        },
    ]);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        Some(milestones),
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let organizer_balance_before = token.balance(&organizer);
    EscrowContract::complete_milestone(env.clone(), escrow_id.clone(), 1);
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert!(escrow.milestones.get(0).unwrap().completed);
    assert!(token.balance(&organizer) > organizer_balance_before);
}

#[test]
fn test_emergency_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let mut ledger = env.ledger().get();
    ledger.timestamp += 3600; // Wait for emergency delay
    env.ledger().set(ledger);
    
    let balance_before = token.balance(&purchaser);
    EscrowContract::emergency_withdraw(env.clone(), escrow_id.clone());
    
    let escrow = EscrowContract::get_escrow(env, escrow_id);
    assert_eq!(escrow.status, EscrowStatus::EmergencyWithdrawn);
    
    assert!(token.balance(&purchaser) > balance_before);
}

#[test]
fn test_pause_and_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    
    assert!(!EscrowContract::is_paused(env.clone()));
    
    EscrowContract::pause(env.clone(), admin.clone());
    assert!(EscrowContract::is_paused(env.clone()));
    
    EscrowContract::unpause(env.clone(), admin.clone());
    assert!(!EscrowContract::is_paused(env));
}

#[test]
fn test_pause_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let unauthorized = Address::generate(&env);
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::pause(env, unauthorized);
    });
    assert!(result.is_err());
}

#[test]
fn test_track_referral() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let referral = Address::generate(&env);
    let purchaser = Address::generate(&env);
    
    EscrowContract::track_referral(env.clone(), referral.clone(), purchaser.clone());
    
    let tracker = EscrowContract::get_referral_tracker(env, referral);
    assert_eq!(tracker.total_referrals, 1);
    assert_eq!(tracker.successful_conversions, 0);
}

#[test]
fn test_upgrade_management() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    
    let new_wasm_hash = BytesN::from_array(&env, &[1; 32]);
    let unlock_time = env.ledger().timestamp() + 1000;
    
    EscrowContract::schedule_upgrade(env.clone(), admin.clone(), new_wasm_hash.clone(), unlock_time);
    
    let mut ledger = env.ledger().get();
    ledger.timestamp = unlock_time + 1;
    env.ledger().set(ledger);
    
    EscrowContract::execute_upgrade(env.clone(), admin.clone(), new_wasm_hash);
    EscrowContract::migrate_state(env, admin.clone(), 2);
    
    assert_eq!(EscrowContract::version(env), 2);
}

#[test]
fn test_revenue_split_validation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let invalid_split = RevenueSplit {
        organizer_percentage: 11000000, // 110% - invalid
        platform_percentage: 1500000,
        referral_percentage: 500000,
        precision: 10000000,
    };
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::create_escrow(
            env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            5000000,
            token.address(),
            release_time,
            Some(invalid_split),
            None,
            None,
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_edge_case_zero_amount_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::create_escrow(
            env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            0, // Zero amount
            token.address(),
            release_time,
            None,
            None,
            None,
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_multiple_escrows_per_user() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event1 = Address::generate(&env);
    let event2 = Address::generate(&env);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id1 = EscrowContract::create_escrow(
        env.clone(),
        event1.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    let escrow_id2 = EscrowContract::create_escrow(
        env.clone(),
        event2.clone(),
        organizer.clone(),
        purchaser.clone(),
        3000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    let user_escrows = EscrowContract::get_user_escrows(env, purchaser);
    assert_eq!(user_escrows.len(), 2);
}

#[test]
fn test_reentrancy_protection() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token) = setup_escrow_contract(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&purchaser, &10000000);
    
    let release_time = env.ledger().timestamp() + 86400;
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        5000000,
        token.address(),
        release_time,
        None,
        None,
        None,
    );
    
    EscrowContract::lock_escrow(env.clone(), escrow_id.clone());
    
    let mut ledger = env.ledger().get();
    ledger.timestamp = release_time + 1;
    env.ledger().set(ledger);
    
    EscrowContract::release_escrow(env, escrow_id);
}
