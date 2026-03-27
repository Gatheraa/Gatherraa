use soroban_sdk::{Address, Env, Symbol, Vec, Map};
use crate::{FeatureFlagContract, FeatureFlag, Environment, RolloutStrategy, TestVariant, ABTestStatus, RolloutStage};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let version = FeatureFlagContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_create_feature_flag() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let created_by = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let key = Symbol::new(&env, "new_feature");
    let tags = vec![&env, Symbol::new(&env, "beta"), Symbol::new(&env, "experimental")];
    
    FeatureFlagContract::create_feature_flag(
        env.clone(),
        key.clone(),
        true,  // enabled
        50,    // 50% rollout
        Environment::Production,
        String::from_str(&env, "Test feature for gradual rollout"),
        created_by.clone(),
        tags.clone(),
        RolloutStrategy::Gradual,
    );
    
    let flag = FeatureFlagContract::get_feature_flag(env.clone(), key.clone());
    assert_eq!(flag.key, key);
    assert!(flag.enabled);
    assert_eq!(flag.rollout_percentage, 50);
    assert_eq!(flag.environment, Environment::Production);
    assert_eq!(flag.created_by, created_by);
}

#[test]
fn test_evaluate_flag_gradual_rollout() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let created_by = Address::generate(&env);
    let user = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let key = Symbol::new(&env, "test_feature");
    FeatureFlagContract::create_feature_flag(
        env.clone(),
        key.clone(),
        true,
        50, // 50% rollout
        Environment::Production,
        String::from_str(&env, "Test feature"),
        created_by.clone(),
        Vec::new(&env),
        RolloutStrategy::Gradual,
    );
    
    let context = Map::new(&env);
    let result = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), context);
    
    // Result should be deterministic based on user hash
    // We can't predict the exact result, but it should be consistent
    let result2 = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), Map::new(&env));
    assert_eq!(result, result2);
}

#[test]
fn test_evaluate_flag_segmented() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let created_by = Address::generate(&env);
    let user = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let key = Symbol::new(&env, "segmented_feature");
    FeatureFlagContract::create_feature_flag(
        env.clone(),
        key.clone(),
        true,
        100, // Full rollout for segmented users
        Environment::Production,
        String::from_str(&env, "Segmented feature"),
        created_by.clone(),
        Vec::new(&env),
        RolloutStrategy::Segmented,
    );
    
    // Add user to segment
    let segments = vec![&env, Symbol::new(&env, "beta_users")];
    let attributes = Map::new(&env);
    FeatureFlagContract::add_user_segment(env.clone(), user.clone(), segments.clone(), attributes.clone());
    
    let context = Map::new(&env);
    let result = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), context);
    
    // User should not get the feature since the flag doesn't have the segment configured
    // In a real implementation, we'd need to add segments to the flag
    assert!(!result);
}

#[test]
fn test_create_ab_test() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let test_id = Symbol::new(&env, "test_ab");
    let feature_flag = Symbol::new(&env, "feature_to_test");
    
    let variants = vec![
        &env,
        TestVariant {
            id: Symbol::new(&env, "control"),
            name: String::from_str(&env, "Control Group"),
            weight: 50,
            config: Map::new(&env),
        },
        TestVariant {
            id: Symbol::new(&env, "variant_a"),
            name: String::from_str(&env, "Variant A"),
            weight: 50,
            config: Map::new(&env),
        },
    ];
    
    let mut traffic_allocation = Map::new(&env);
    traffic_allocation.set(Symbol::new(&env, "control"), 50);
    traffic_allocation.set(Symbol::new(&env, "variant_a"), 50);
    
    FeatureFlagContract::create_ab_test(
        env.clone(),
        test_id.clone(),
        String::from_str(&env, "A/B Test for Feature"),
        feature_flag.clone(),
        variants.clone(),
        traffic_allocation.clone(),
        env.ledger().timestamp(),
        env.ledger().timestamp() + 86400 * 7, // 1 week
        1000, // sample size
        95,   // confidence threshold
    );
    
    let test = FeatureFlagContract::get_ab_test(env.clone(), test_id.clone());
    assert_eq!(test.id, test_id);
    assert_eq!(test.feature_flag, feature_flag);
    assert_eq!(test.status, ABTestStatus::Draft);
    assert_eq!(test.variants.len(), 2);
}

#[test]
fn test_get_ab_test_variant() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let test_id = Symbol::new(&env, "variant_test");
    let feature_flag = Symbol::new(&env, "feature");
    
    let variants = vec![
        &env,
        TestVariant {
            id: Symbol::new(&env, "control"),
            name: String::from_str(&env, "Control"),
            weight: 50,
            config: Map::new(&env),
        },
        TestVariant {
            id: Symbol::new(&env, "treatment"),
            name: String::from_str(&env, "Treatment"),
            weight: 50,
            config: Map::new(&env),
        },
    ];
    
    let mut traffic_allocation = Map::new(&env);
    traffic_allocation.set(Symbol::new(&env, "control"), 50);
    traffic_allocation.set(Symbol::new(&env, "treatment"), 50);
    
    FeatureFlagContract::create_ab_test(
        env.clone(),
        test_id.clone(),
        String::from_str(&env, "Test"),
        feature_flag.clone(),
        variants.clone(),
        traffic_allocation.clone(),
        env.ledger().timestamp() - 3600, // Started 1 hour ago
        env.ledger().timestamp() + 86400 * 7,
        1000,
        95,
    );
    
    // Update test status to running (in real implementation, there would be a function for this)
    // For now, we'll test the variant assignment logic
    
    let variant = FeatureFlagContract::get_ab_test_variant(env.clone(), test_id.clone(), user.clone());
    
    // Variant should be deterministic for the same user
    let variant2 = FeatureFlagContract::get_ab_test_variant(env.clone(), test_id.clone(), user.clone());
    assert_eq!(variant, variant2);
    
    // Variant should be one of the configured variants
    if let Some(variant_id) = variant {
        assert!(variant_id == Symbol::new(&env, "control") || variant_id == Symbol::new(&env, "treatment"));
    }
}

#[test]
fn test_create_rollout_plan() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let feature_flag = Symbol::new(&env, "gradual_feature");
    
    let stages = vec![
        &env,
        RolloutStage {
            percentage: 10,
            duration: 86400,  // 1 day
            criteria: Vec::new(&env),
            completed: false,
        },
        RolloutStage {
            percentage: 50,
            duration: 86400 * 3, // 3 days
            criteria: Vec::new(&env),
            completed: false,
        },
        RolloutStage {
            percentage: 100,
            duration: 86400 * 7, // 1 week
            criteria: Vec::new(&env),
            completed: false,
        },
    ];
    
    FeatureFlagContract::create_rollout_plan(
        env.clone(),
        feature_flag.clone(),
        stages.clone(),
        true, // auto_advance
    );
    
    let plan = FeatureFlagContract::get_rollout_plan(env.clone(), feature_flag.clone());
    assert_eq!(plan.feature_flag, feature_flag);
    assert_eq!(plan.stages.len(), 3);
    assert_eq!(plan.current_stage, 0);
    assert!(plan.auto_advance);
}

#[test]
fn test_kill_switch() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let created_by = Address::generate(&env);
    let user = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let key = Symbol::new(&env, "critical_feature");
    FeatureFlagContract::create_feature_flag(
        env.clone(),
        key.clone(),
        true,
        100,
        Environment::Production,
        String::from_str(&env, "Critical feature"),
        created_by.clone(),
        Vec::new(&env),
        RolloutStrategy::Immediate,
    );
    
    // Feature should be enabled initially
    let context = Map::new(&env);
    let result = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), context.clone());
    assert!(result);
    
    // Activate kill switch
    FeatureFlagContract::activate_kill_switch(
        env.clone(),
        key.clone(),
        String::from_str(&env, "Critical bug discovered"),
        true, // auto_recovery
        Some(env.ledger().timestamp() + 3600), // recover in 1 hour
    );
    
    // Feature should now be disabled due to kill switch
    let result = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), context.clone());
    assert!(!result);
    
    // Deactivate kill switch
    FeatureFlagContract::deactivate_kill_switch(env.clone(), key.clone());
    
    // Feature should be enabled again
    let result = FeatureFlagContract::evaluate_flag(env.clone(), key.clone(), user.clone(), context.clone());
    assert!(result);
}

#[test]
fn test_user_segmentation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let segments = vec![&env, Symbol::new(&env, "premium"), Symbol::new(&env, "early_adopter")];
    let mut attributes = Map::new(&env);
    attributes.set(Symbol::new(&env, "tier"), Symbol::new(&env, "premium").into_val(&env));
    attributes.set(Symbol::new(&env, "join_date"), 1640995200.into_val(&env)); // 2022-01-01
    
    FeatureFlagContract::add_user_segment(env.clone(), user.clone(), segments.clone(), attributes.clone());
    
    let user_segment = FeatureFlagContract::get_user_segment(env.clone(), user.clone());
    assert_eq!(user_segment.user, user);
    assert_eq!(user_segment.segments.len(), 2);
    assert!(user_segment.segments.contains(&Symbol::new(&env, "premium")));
    assert!(user_segment.segments.contains(&Symbol::new(&env, "early_adopter")));
    assert_eq!(user_segment.attributes.get(Symbol::new(&env, "tier")), Some(&Symbol::new(&env, "premium").into_val(&env)));
}

#[test]
fn test_update_feature_flag() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let created_by = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    let key = Symbol::new(&env, "updatable_feature");
    FeatureFlagContract::create_feature_flag(
        env.clone(),
        key.clone(),
        false, // initially disabled
        25,
        Environment::Development,
        String::from_str(&env, "Original description"),
        created_by.clone(),
        Vec::new(&env),
        RolloutStrategy::Immediate,
    );
    
    // Update the flag
    let new_tags = vec![&env, Symbol::new(&env, "updated")];
    FeatureFlagContract::update_feature_flag(
        env.clone(),
        key.clone(),
        Some(true),  // enable it
        Some(75),    // increase rollout
        Some(String::from_str(&env, "Updated description")),
        Some(new_tags.clone()),
    );
    
    let flag = FeatureFlagContract::get_feature_flag(env.clone(), key.clone());
    assert!(flag.enabled);
    assert_eq!(flag.rollout_percentage, 75);
    assert_eq!(flag.description, String::from_str(&env, "Updated description"));
    assert_eq!(flag.tags.len(), 1);
    assert!(flag.tags.contains(&Symbol::new(&env, "updated")));
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    FeatureFlagContract::initialize(env.clone(), admin.clone());
    
    // Pause the contract
    FeatureFlagContract::pause(env.clone());
    
    // Unpause the contract
    FeatureFlagContract::unpause(env.clone());
}
