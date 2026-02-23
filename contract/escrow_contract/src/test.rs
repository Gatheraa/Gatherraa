use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{EscrowContract, EscrowStatus, RevenueSplit, Milestone, RevenueSplitConfig, ReferralTracker};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000, // 80%
        default_platform_percentage: 1500000,  // 15%
        default_referral_percentage: 500000,   // 5%
        max_referral_percentage: 10000000,     // 100%
        precision: 10000000,                   // 7 decimal places
        min_escrow_amount: 1000000,            // 0.1 XLM
        max_escrow_amount: 10000000000,        // 1000 XLM
        dispute_timeout: 86400,                // 24 hours
        emergency_withdrawal_delay: 3600,       // 1 hour
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let stored_config = EscrowContract::get_config(env.clone());
    assert_eq!(stored_config.default_organizer_percentage, config.default_organizer_percentage);
    assert_eq!(stored_config.default_platform_percentage, config.default_platform_percentage);
    assert_eq!(stored_config.default_referral_percentage, config.default_referral_percentage);
}

#[test]
fn test_create_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000, // 1 XLM
        token.clone(),
        env.ledger().timestamp() + 86400, // 24 hours from now
        None, // default revenue splits
        None, // no referral
        None, // no milestones
    );

    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.event, event);
    assert_eq!(escrow.organizer, organizer);
    assert_eq!(escrow.purchaser, purchaser);
    assert_eq!(escrow.amount, 10000000);
    assert_eq!(escrow.token, token);
    assert_eq!(escrow.status, EscrowStatus::Pending);
}

#[test]
fn test_lock_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000,
        token.clone(),
        env.ledger().timestamp() + 86400,
        None,
        None,
        None,
    );

    // Mock token transfer
    let token_contract_id = Address::generate(&env);
    env.register_contract_token(&token_contract_id, &token);
    
    EscrowContract::lock_escrow(env.clone(), escrow_id);
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Locked);
}

#[test]
fn test_release_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000,
        token.clone(),
        env.ledger().timestamp(), // Release immediately
        None,
        None,
        None,
    );

    // Mock token transfer and set up balance
    let token_contract_id = Address::generate(&env);
    env.register_contract_token(&token_contract_id, &token);
    
    EscrowContract::lock_escrow(env.clone(), escrow_id);
    EscrowContract::release_escrow(env.clone(), escrow_id);
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
fn test_referral_tracking() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let referrer = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000,
        token.clone(),
        env.ledger().timestamp() + 86400,
        None,
        Some(referrer.clone()),
        None,
    );

    let referral_info = EscrowContract::get_referral_info(env.clone(), referrer.clone());
    assert_eq!(referral_info.referral_count, 1);
    assert_eq!(referral_info.total_rewards, 0); // No rewards yet until release
}

#[test]
fn test_milestone_release() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let milestones = vec![
        &env,
        Milestone {
            id: 1,
            amount: 5000000, // 0.5 XLM
            release_time: env.ledger().timestamp(),
            released: false,
        },
        Milestone {
            id: 2,
            amount: 5000000, // 0.5 XLM
            release_time: env.ledger().timestamp() + 3600,
            released: false,
        },
    ];
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000,
        token.clone(),
        env.ledger().timestamp() + 86400,
        None,
        None,
        Some(milestones),
    );

    let token_contract_id = Address::generate(&env);
    env.register_contract_token(&token_contract_id, &token);
    
    EscrowContract::lock_escrow(env.clone(), escrow_id);
    EscrowContract::release_milestone(env.clone(), escrow_id, 1);
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.milestones.get_unchecked(0).released, true);
    assert_eq!(escrow.milestones.get_unchecked(1).released, false);
}

#[test]
fn test_dispute_creation_and_resolution() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let organizer = Address::generate(&env);
    let purchaser = Address::generate(&env);
    let event = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = RevenueSplitConfig {
        default_organizer_percentage: 8000000,
        default_platform_percentage: 1500000,
        default_referral_percentage: 500000,
        max_referral_percentage: 10000000,
        precision: 10000000,
        min_escrow_amount: 1000000,
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config);
    
    let escrow_id = EscrowContract::create_escrow(
        env.clone(),
        event.clone(),
        organizer.clone(),
        purchaser.clone(),
        10000000,
        token.clone(),
        env.ledger().timestamp() + 86400,
        None,
        None,
        None,
    );

    let token_contract_id = Address::generate(&env);
    env.register_contract_token(&token_contract_id, &token);
    
    EscrowContract::lock_escrow(env.clone(), escrow_id);
    
    // Create dispute
    EscrowContract::create_dispute(
        env.clone(),
        escrow_id,
        purchaser.clone(),
        Symbol::new(&env, "service_not_provided"),
        vec![&env, Symbol::new(&env, "evidence1")],
    );
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert!(escrow.dispute_active);
    
    // Resolve dispute
    let resolution = crate::DisputeResolution {
        winner: purchaser.clone(),
        refund_amount: 8000000, // 0.8 XLM refund
        penalty_amount: 2000000, // 0.2 XLM penalty
    };
    
    EscrowContract::resolve_dispute(env.clone(), escrow_id, resolution);
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert!(!escrow.dispute_active);
}
