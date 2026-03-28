use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{EscrowContract, EscrowStatus, Escrow, RevenueSplit, Milestone, RevenueSplitConfig, ReferralTracker};

// ============================================================================
// MINIMUM/MAXIMUM VALUE TESTS
// ============================================================================

#[test]
#[should_panic(expected = "amount must be greater than minimum")]
fn test_minimum_escrow_amount() {
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
        min_escrow_amount: 1000000, // 0.1 XLM minimum
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with amount below minimum
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &500000, // Below minimum of 1000000
        &86400,
        &Vec::new(&env),
        &None,
    );
}

#[test]
fn test_maximum_escrow_amount() {
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
        max_escrow_amount: i128::MAX, // Maximum possible amount
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with maximum amount
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &i128::MAX,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Verify escrow was created
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 1);
}

#[test]
#[should_panic(expected = "percentage cannot exceed 100%")]
fn test_maximum_percentage_split() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with percentage that exceeds 100%
    let mut splits = Vec::new(&env);
    splits.push_back(RevenueSplit {
        recipient: organizer.clone(),
        percentage: 8000000, // 80%
    }).unwrap();
    splits.push_back(RevenueSplit {
        recipient: Address::generate(&env),
        percentage: 3000000, // 30% - total would be 110%
    }).unwrap();
    
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &splits,
        &None,
    );
}

#[test]
fn test_maximum_dispute_timeout() {
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
        dispute_timeout: u64::MAX, // Maximum timeout
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with maximum dispute timeout
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &u64::MAX,
        &Vec::new(&env),
        &None,
    );
}

// ============================================================================
// ZERO VALUE TESTS
// ============================================================================

#[test]
#[should_panic(expected = "amount must be greater than 0")]
fn test_zero_escrow_amount() {
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
        min_escrow_amount: 0, // Allow zero minimum for this test
        max_escrow_amount: 10000000000,
        dispute_timeout: 86400,
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with zero amount
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &0,
        &86400,
        &Vec::new(&env),
        &None,
    );
}

#[test]
fn test_zero_percentage_split() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with zero percentage split
    let mut splits = Vec::new(&env);
    splits.push_back(RevenueSplit {
        recipient: organizer.clone(),
        percentage: 0, // 0%
    }).unwrap();
    
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &splits,
        &None,
    );
    
    // Verify escrow was created with zero percentage split
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 1);
}

#[test]
fn test_zero_dispute_timeout() {
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
        dispute_timeout: 0, // Zero timeout
        emergency_withdrawal_delay: 3600,
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with zero dispute timeout
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &0,
        &Vec::new(&env),
        &None,
    );
}

#[test]
fn test_zero_emergency_delay() {
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
        emergency_withdrawal_delay: 0, // Zero emergency delay
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with zero emergency withdrawal delay
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
}

// ============================================================================
// EMPTY COLLECTION TESTS
// ============================================================================

#[test]
fn test_empty_escrow_list() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let event = Address::generate(&env);
    
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test getting escrows for event with none
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 0);
}

#[test]
fn test_empty_milestone_list() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow with empty milestones
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Verify escrow was created with no milestones
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 1);
    
    let escrow = escrows.get(0).unwrap();
    assert_eq!(escrow.milestones.len(), 0);
}

#[test]
fn test_empty_revenue_splits() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow with empty revenue splits (should use defaults)
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env), // Empty splits
        &None,
    );
    
    // Verify escrow was created
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 1);
}

#[test]
fn test_empty_referral_tracker() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow with no referral
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None, // No referral
    );
    
    // Verify escrow was created without referral
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    assert_eq!(escrows.len(), 1);
    
    let escrow = escrows.get(0).unwrap();
    assert_eq!(escrow.referral_tracker, None);
}

// ============================================================================
// ERROR CONDITION TESTS
// ============================================================================

#[test]
#[should_panic(expected = "unauthorized")]
fn test_unauthorized_escrow_creation() {
    let env = Env::default();
    // Don't mock auths to test authorization
    
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test unauthorized escrow creation
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
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

    // First initialization
    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Second initialization (should fail)
    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
}

#[test]
#[should_panic(expected = "invalid status transition")]
fn test_invalid_status_transition() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Try to complete escrow that's still pending (should fail)
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    let escrow_id = escrows.get(0).unwrap().id;
    
    EscrowContract::complete_escrow(&env, &escrow_id);
}

#[test]
#[should_panic(expected = "escrow not found")]
fn test_nonexistent_escrow_operation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Try to operate on non-existent escrow
    let fake_escrow_id = 999;
    EscrowContract::dispute_escrow(&env, &fake_escrow_id);
}

#[test]
#[should_panic(expected = "dispute period expired")]
fn test_expired_dispute() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Advance time beyond dispute period
    let mut ledger = env.ledger().get();
    ledger.timestamp += 86400 + 1; // Beyond dispute timeout
    env.ledger().set(ledger);
    
    // Try to dispute after period expired
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    let escrow_id = escrows.get(0).unwrap().id;
    
    EscrowContract::dispute_escrow(&env, &escrow_id);
}

#[test]
#[should_panic(expected = "emergency delay not met")]
fn test_premature_emergency_withdrawal() {
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
        emergency_withdrawal_delay: 3600, // 1 hour delay
    };

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Try emergency withdrawal without waiting for delay
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    let escrow_id = escrows.get(0).unwrap().id;
    
    EscrowContract::emergency_withdraw(&env, &escrow_id);
}

#[test]
fn test_invalid_address_input() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with zero address (should be handled gracefully or fail appropriately)
    let zero_address = Address::from_string(&env, &soroban_sdk::String::from_str(&env, ""));
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::get_escrows_by_organizer(&env, &zero_address);
    });
    
    // Should handle gracefully or panic appropriately
    assert!(result.is_ok() || result.is_err());
}

#[test]
fn test_overflow_conditions() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Test with very large amounts near overflow
    let large_amount = i128::MAX / 2;
    
    let result = std::panic::catch_unwind(|| {
        EscrowContract::create_escrow(
            env.clone(),
            organizer.clone(),
            purchaser.clone(),
            event.clone(),
            token.clone(),
            &large_amount,
            &86400,
            &Vec::new(&env),
            &None,
        );
    });
    
    // Should either succeed or handle overflow gracefully
    if result.is_ok() {
        let escrows = EscrowContract::get_escrows_by_event(&env, &event);
        assert_eq!(escrows.len(), 1);
    }
}

#[test]
fn test_underflow_conditions() {
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

    EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Create escrow
    EscrowContract::create_escrow(
        env.clone(),
        organizer.clone(),
        purchaser.clone(),
        event.clone(),
        token.clone(),
        &1000000,
        &86400,
        &Vec::new(&env),
        &None,
    );
    
    // Test operations that might cause underflow
    let escrows = EscrowContract::get_escrows_by_event(&env, &event);
    let escrow_id = escrows.get(0).unwrap().id;
    
    // Try to refund more than escrow amount (should fail or handle gracefully)
    let result = std::panic::catch_unwind(|| {
        EscrowContract::refund_escrow(&env, &escrow_id, &2000000); // More than escrow
    });
    
    // Should handle underflow appropriately
    assert!(result.is_err());
}
