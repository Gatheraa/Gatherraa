use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{EscrowContract, EscrowStatus, Escrow, RevenueSplit, Milestone, RevenueSplitConfig, ReferralTracker};
use gathera_common::gas_testing::{GasTestFramework, GasBenchmark, GasRegressionTest};

fn create_escrow_contract_with_gas_framework(env: &Env, admin: &Address, config: RevenueSplitConfig) -> (Address, GasTestFramework) {
    let gas_framework = GasTestFramework::with_defaults(env);
    
    // Measure gas usage for initialization
    let contract_address = gas_framework.measure_gas(
        Symbol::new(env, "escrow_initialize"),
        None,
        || {
            EscrowContract::initialize(env.clone(), admin.clone(), config.clone());
        }
    );

    (contract_address, gas_framework)
}

#[test]
fn test_initialize_with_gas() {
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

    let (_, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config.clone());
    
    // Verify initialization gas usage
    let init_op = Symbol::new(&env, "escrow_initialize");
    assert!(gas_framework.assert_gas_benchmark(&init_op).is_ok());
    
    let stored_config = EscrowContract::get_config(env.clone());
    assert_eq!(stored_config.default_organizer_percentage, config.default_organizer_percentage);
    assert_eq!(stored_config.default_platform_percentage, config.default_platform_percentage);
    assert_eq!(stored_config.default_referral_percentage, config.default_referral_percentage);
}

#[test]
fn test_create_escrow_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
    // Measure gas usage for create_escrow
    let escrow_id = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_create"),
        Some(contract_address.clone()),
        || {
            EscrowContract::create_escrow(
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
            )
        }
    );

    // Verify create_escrow gas usage
    let create_op = Symbol::new(&env, "escrow_create");
    assert!(gas_framework.assert_gas_benchmark(&create_op).is_ok());

    // Check for gas regression
    assert!(gas_framework.assert_no_regression(&create_op).is_ok());

    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.event, event);
    assert_eq!(escrow.organizer, organizer);
    assert_eq!(escrow.purchaser, purchaser);
    assert_eq!(escrow.amount, 10000000);
    assert_eq!(escrow.token, token);
    assert_eq!(escrow.status, EscrowStatus::Pending);
}

#[test]
fn test_lock_escrow_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
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
    
    // Measure gas usage for lock_escrow
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_lock"),
        Some(contract_address.clone()),
        || {
            EscrowContract::lock_escrow(env.clone(), escrow_id);
        }
    );
    
    // Verify lock_escrow gas usage
    let lock_op = Symbol::new(&env, "escrow_lock");
    assert!(gas_framework.assert_gas_benchmark(&lock_op).is_ok());
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Locked);
}

#[test]
fn test_release_escrow_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
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
    
    // Measure gas usage for release_escrow
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_release"),
        Some(contract_address.clone()),
        || {
            EscrowContract::release_escrow(env.clone(), escrow_id);
        }
    );
    
    // Verify release_escrow gas usage
    let release_op = Symbol::new(&env, "escrow_release");
    assert!(gas_framework.assert_gas_benchmark(&release_op).is_ok());
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
fn test_referral_tracking_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
    // Measure gas usage for create_escrow with referral
    let escrow_id = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_create_with_referral"),
        Some(contract_address.clone()),
        || {
            EscrowContract::create_escrow(
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
            )
        }
    );

    // Verify create_escrow_with_referral gas usage
    let create_referral_op = Symbol::new(&env, "escrow_create_with_referral");
    assert!(gas_framework.assert_gas_benchmark(&create_op).is_ok());

    let referral_info = EscrowContract::get_referral_info(env.clone(), referrer.clone());
    assert_eq!(referral_info.referral_count, 1);
    assert_eq!(referral_info.total_rewards, 0); // No rewards yet until release
}

#[test]
fn test_milestone_release_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
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
    
    // Measure gas usage for release_milestone
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_release_milestone"),
        Some(contract_address.clone()),
        || {
            EscrowContract::release_milestone(env.clone(), escrow_id, 1);
        }
    );
    
    // Verify release_milestone gas usage
    let milestone_op = Symbol::new(&env, "escrow_release_milestone");
    assert!(gas_framework.assert_gas_benchmark(&milestone_op).is_ok());
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.milestones.get_unchecked(0).released, true);
    assert_eq!(escrow.milestones.get_unchecked(1).released, false);
}

#[test]
fn test_dispute_creation_and_resolution_with_gas() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
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
    
    // Measure gas usage for create_dispute
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_create_dispute"),
        Some(contract_address.clone()),
        || {
            EscrowContract::create_dispute(
                env.clone(),
                escrow_id,
                purchaser.clone(),
                Symbol::new(&env, "service_not_provided"),
                vec![&env, Symbol::new(&env, "evidence1")],
            );
        }
    );
    
    // Verify create_dispute gas usage
    let dispute_op = Symbol::new(&env, "escrow_create_dispute");
    assert!(gas_framework.assert_gas_benchmark(&dispute_op).is_ok());
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert!(escrow.dispute_active);
    
    // Measure gas usage for resolve_dispute
    let resolution = crate::DisputeResolution {
        winner: purchaser.clone(),
        refund_amount: 8000000, // 0.8 XLM refund
        penalty_amount: 2000000, // 0.2 XLM penalty
    };
    
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_resolve_dispute"),
        Some(contract_address.clone()),
        || {
            EscrowContract::resolve_dispute(env.clone(), escrow_id, resolution);
        }
    );
    
    // Verify resolve_dispute gas usage
    let resolve_op = Symbol::new(&env, "escrow_resolve_dispute");
    assert!(gas_framework.assert_gas_benchmark(&resolve_op).is_ok());
    
    let escrow = EscrowContract::get_escrow(env.clone(), escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert!(!escrow.dispute_active);
}

#[test]
fn test_gas_regression_escrow_operations() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
    // Register custom regression tests with stricter baselines
    gas_framework.register_regression_test(GasRegressionTest {
        operation: Symbol::new(&env, "escrow_create_regression"),
        baseline_gas: 100000, // Stricter baseline
        max_regression_percentage: 5, // Only 5% regression allowed
    });
    
    gas_framework.register_regression_test(GasRegressionTest {
        operation: Symbol::new(&env, "escrow_lock_regression"),
        baseline_gas: 50000, // Stricter baseline
        max_regression_percentage: 5,
    });
    
    // Test create escrow regression
    let escrow_id = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_create_regression"),
        Some(contract_address.clone()),
        || {
            EscrowContract::create_escrow(
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
            )
        }
    );

    // Check for gas regression in create
    let create_regression_op = Symbol::new(&env, "escrow_create_regression");
    let result = gas_framework.assert_no_regression(&create_regression_op);
    assert!(result.is_ok(), "Gas regression detected in escrow create operation");

    // Mock token transfer
    let token_contract_id = Address::generate(&env);
    env.register_contract_token(&token_contract_id, &token);
    
    // Test lock escrow regression
    let _ = gas_framework.measure_gas(
        Symbol::new(&env, "escrow_lock_regression"),
        Some(contract_address.clone()),
        || {
            EscrowContract::lock_escrow(env.clone(), escrow_id);
        }
    );

    // Check for gas regression in lock
    let lock_regression_op = Symbol::new(&env, "escrow_lock_regression");
    let result = gas_framework.assert_no_regression(&lock_regression_op);
    assert!(result.is_ok(), "Gas regression detected in escrow lock operation");
}

#[test]
fn test_gas_benchmark_comprehensive_escrow() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
    // Test multiple operations and collect comprehensive gas data
    let operations = vec![
        ("create_escrow_small", || {
            EscrowContract::create_escrow(
                env.clone(),
                event.clone(),
                organizer.clone(),
                purchaser.clone(),
                1000000, // 0.1 XLM
                token.clone(),
                env.ledger().timestamp() + 86400,
                None,
                None,
                None,
            )
        }),
        ("create_escrow_large", || {
            EscrowContract::create_escrow(
                env.clone(),
                event.clone(),
                organizer.clone(),
                purchaser.clone(),
                100000000, // 10 XLM
                token.clone(),
                env.ledger().timestamp() + 86400,
                None,
                None,
                None,
            )
        }),
        ("create_escrow_with_milestones", || {
            let milestones = vec![
                &env,
                Milestone {
                    id: 1,
                    amount: 2500000,
                    release_time: env.ledger().timestamp(),
                    released: false,
                },
                Milestone {
                    id: 2,
                    amount: 2500000,
                    release_time: env.ledger().timestamp() + 3600,
                    released: false,
                },
                Milestone {
                    id: 3,
                    amount: 2500000,
                    release_time: env.ledger().timestamp() + 7200,
                    released: false,
                },
                Milestone {
                    id: 4,
                    amount: 2500000,
                    release_time: env.ledger().timestamp() + 10800,
                    released: false,
                },
            ];
            
            EscrowContract::create_escrow(
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
            )
        }),
    ];

    for (op_name, op_fn) in operations {
        let _ = gas_framework.measure_gas(
            Symbol::new(&env, op_name),
            Some(contract_address.clone()),
            op_fn,
        );
    }

    // Generate comprehensive report
    let report = gas_framework.generate_report();
    
    // Verify all operations were measured
    assert!(report.len() > operations.len() as u32);
    
    // Check that all benchmarks pass
    let benchmark_ops = vec![
        "escrow_initialize",
        "escrow_create",
        "escrow_lock",
        "escrow_release",
    ];
    
    for op_name in benchmark_ops {
        let op_symbol = Symbol::new(&env, op_name);
        let result = gas_framework.assert_gas_benchmark(&op_symbol);
        assert!(result.is_ok(), "Benchmark failed for operation: {}", op_name);
    }
}

#[test]
fn test_gas_limit_scenarios_escrow() {
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

    let (contract_address, mut gas_framework) = create_escrow_contract_with_gas_framework(&env, &admin, config);
    
    // Test escrow creation with different milestone counts to understand gas scaling
    let milestone_counts = vec![1, 5, 10, 20, 50];
    
    for milestone_count in milestone_counts {
        let mut milestones = Vec::new(&env);
        
        for i in 1..=milestone_count {
            milestones.push_back(Milestone {
                id: i,
                amount: 1000000 / milestone_count as i128, // Split 1 XLM across milestones
                release_time: env.ledger().timestamp() + (i as u64 * 3600),
                released: false,
            });
        }
        
        let _ = gas_framework.measure_gas(
            Symbol::new(&env, &format!("create_escrow_{}_milestones", milestone_count)),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_escrow(
                    env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    1000000, // 1 XLM total
                    token.clone(),
                    env.ledger().timestamp() + 86400,
                    None,
                    None,
                    Some(milestones),
                )
            }
        );
    }

    // Analyze gas scaling patterns
    let report = gas_framework.generate_report();
    
    // Verify that more milestones use more gas
    // (but not exponentially more, which would indicate inefficiency)
    let mut gas_measurements = Vec::new();
    
    for milestone_count in milestone_counts {
        let op_name = format!("create_escrow_{}_milestones", milestone_count);
        let op_symbol = Symbol::new(&env, &op_name);
        if let Some(measurement) = gas_framework.get_latest_measurement(&op_symbol) {
            gas_measurements.push((milestone_count, measurement.gas_used));
        }
    }
    
    // Basic sanity check: more milestones should use more gas
    assert!(gas_measurements.len() >= 2);
    for i in 1..gas_measurements.len() {
        let (prev_count, prev_gas) = gas_measurements[i-1];
        let (curr_count, curr_gas) = gas_measurements[i];
        
        // Gas should increase with milestone count
        assert!(curr_gas >= prev_gas, 
            "Gas usage should not decrease with more milestones: {}->{} milestones: {}->{} gas",
            prev_count, curr_count, prev_gas, curr_gas);
        
        // But not by more than 5x per 10x increase (check for reasonable scaling)
        if curr_count >= prev_count * 10 {
            let max_expected_gas = prev_gas * 5;
            assert!(curr_gas <= max_expected_gas,
                "Gas scaling appears excessive: {}->{} milestones: {}->{} gas (max expected: {})",
                prev_count, curr_count, prev_gas, curr_gas, max_expected_gas);
        }
    }
}

// ─── Tests for extracted compute_revenue_splits helper ─────────────────────────────────

fn make_escrow(env: &Env, amount: i128, org_pct: u32, plat_pct: u32, ref_pct: u32, precision: u32) -> Escrow {
    let organizer = Address::generate(env);
    let purchaser = Address::generate(env);
    let event = Address::generate(env);
    let token = Address::generate(env);
    Escrow {
        id: BytesN::from_array(env, &[0; 32]),
        event,
        organizer,
        purchaser,
        amount,
        token,
        created_at: 0,
        release_time: 0,
        status: EscrowStatus::Pending,
        revenue_splits: RevenueSplit {
            organizer_percentage: org_pct,
            platform_percentage: plat_pct,
            referral_percentage: ref_pct,
            precision,
        },
        referral: None,
        milestones: Vec::new(env),
        dispute_active: false,
    }
}

#[test]
fn test_compute_revenue_splits_sums_to_amount() {
    // All three amounts must sum exactly to the total (precision = 100).
    let env = Env::default();
    // 70% org, 20% plat, 10% ref, precision=100
    let escrow = make_escrow(&env, 1000, 70, 20, 10, 100);
    let (org, plat, referral) = EscrowContract::compute_revenue_splits(&escrow);
    assert_eq!(org + plat + referral, escrow.amount);
    assert_eq!(org, 700);
    assert_eq!(plat, 200);
    assert_eq!(referral, 100);
}

#[test]
fn test_compute_revenue_splits_rounding_adjustment() {
    // With amounts that don't divide evenly, the referral slice absorbs rounding.
    let env = Env::default();
    // 70% org, 20% plat, 10% ref, precision=100, amount=101
    let escrow = make_escrow(&env, 101, 70, 20, 10, 100);
    let (org, plat, referral) = EscrowContract::compute_revenue_splits(&escrow);
    // Total must not exceed 101
    assert!(org + plat + referral <= escrow.amount);
}

#[test]
fn test_compute_revenue_splits_no_referral() {
    // When referral_percentage is 0, referral_amount is 0 and others sum correctly.
    let env = Env::default();
    let escrow = make_escrow(&env, 1000, 80, 20, 0, 100);
    let (org, plat, referral) = EscrowContract::compute_revenue_splits(&escrow);
    assert_eq!(referral, 0);
    assert_eq!(org + plat, escrow.amount);
}
