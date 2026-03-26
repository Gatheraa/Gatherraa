use soroban_sdk::{Address, Env, Symbol, Vec};
use crate::{StorageInitializationContract, InitializationState, DefaultStrategy, InitializationConfig, DefaultValue, ValidationResult};

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: true,
        auto_fix_issues: true,
        validation_enabled: true,
        backup_before_fix: false,
        max_retry_attempts: 3,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let state = StorageInitializationContract::get_initialization_state(env.clone());
    assert_eq!(state, InitializationState::Initialized);
    
    let version = StorageInitializationContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_safe_get_uninitialized() {
    let env = Env::default();
    
    // Try to get value from uninitialized contract
    let result = StorageInitializationContract::safe_get::<bool>(env.clone(), crate::DataKey::Paused);
    assert!(result.is_err());
}

#[test]
fn test_safe_get_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        validation_enabled: false,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Should be able to get values after initialization
    let paused_result = StorageInitializationContract::safe_get::<bool>(env.clone(), crate::DataKey::Paused);
    assert!(paused_result.is_ok());
}

#[test]
fn test_safe_set_uninitialized() {
    let env = Env::default();
    
    // Try to set value in uninitialized contract
    let result = StorageInitializationContract::safe_set(env.clone(), crate::DataKey::Paused, true);
    assert!(result.is_err());
}

#[test]
fn test_safe_set_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        validation_enabled: false,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Should be able to set values after initialization
    let result = StorageInitializationContract::safe_set(env.clone(), crate::DataKey::Paused, true);
    assert!(result.is_ok());
}

#[test]
fn test_validate_storage_key() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: true,
        auto_fix_issues: false,
        validation_enabled: true,
        backup_before_fix: false,
        max_retry_attempts: 3,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let key = Symbol::new(&env, "test_key");
    let result = StorageInitializationContract::validate_storage_key(env.clone(), key.clone());
    
    assert_eq!(result.storage_key, key);
    assert!(result.is_valid); // Should be valid in initialized contract
}

#[test]
fn test_validate_all_storage() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: true,
        auto_fix_issues: false,
        validation_enabled: true,
        backup_before_fix: false,
        max_retry_attempts: 3,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let results = StorageInitializationContract::validate_all_storage(env.clone());
    
    // Should have validation results for required keys
    assert!(results.len() > 0);
    
    // All should be valid in properly initialized contract
    for result in results.iter() {
        assert!(result.is_valid);
    }
}

#[test]
fn test_apply_defaults() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        validation_enabled: false,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let results = StorageInitializationContract::apply_defaults(env.clone());
    
    // Should have results for applied defaults
    assert!(results.len() > 0);
    
    for result in results.iter() {
        assert!(result.default_applied);
    }
}

#[test]
fn test_get_storage_health() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: true,
        auto_fix_issues: true,
        validation_enabled: true,
        backup_before_fix: false,
        max_retry_attempts: 3,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let health = StorageInitializationContract::get_storage_health(env.clone());
    
    assert!(health.total_keys > 0);
    assert!(health.initialized_keys > 0);
    assert!(health.health_score >= 0.0 && health.health_score <= 1.0);
}

#[test]
fn test_repair_storage() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let keys = vec![&env, Symbol::new(&env, "test_key")];
    let results = StorageInitializationContract::repair_storage(env.clone(), keys.clone());
    
    assert_eq!(results.len(), 1);
    assert!(results.get(0).unwrap().default_applied);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        validation_enabled: false,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    // Pause contract
    StorageInitializationContract::pause(env.clone());
    
    // Try to get value while paused
    let result = StorageInitializationContract::safe_get::<bool>(env.clone(), crate::DataKey::Paused);
    assert!(result.is_err());
    
    // Unpause contract
    StorageInitializationContract::unpause(env.clone());
    
    // Should be able to get value after unpausing
    let result = StorageInitializationContract::safe_get::<bool>(env.clone(), crate::DataKey::Paused);
    assert!(result.is_ok());
}

#[test]
fn test_default_value_strategies() {
    let env = Env::default();
    
    // Test different default value strategies
    let zero_default = DefaultValue {
        key: Symbol::new(&env, "zero_key"),
        strategy: DefaultStrategy::Zero,
        value: None,
        required: false,
        validation_function: None,
    };
    
    let custom_default = DefaultValue {
        key: Symbol::new(&env, "custom_key"),
        strategy: DefaultStrategy::Custom(42.into_val(&env)),
        value: Some(42.into_val(&env)),
        required: false,
        validation_function: None,
    };
    
    assert_eq!(zero_default.strategy, DefaultStrategy::Zero);
    assert_eq!(custom_default.strategy, DefaultStrategy::Custom(42.into_val(&env)));
}

#[test]
fn test_initialization_states() {
    let env = Env::default();
    
    // Initial state should be NotInitialized
    let state = StorageInitializationContract::get_initialization_state(env.clone());
    assert_eq!(state, InitializationState::NotInitialized);
    
    // After initialization, state should be Initialized
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let config = InitializationConfig {
        strict_mode: false,
        auto_fix_issues: true,
        validation_enabled: false,
        backup_before_fix: false,
        max_retry_attempts: 1,
        initialization_timeout: 300,
    };
    
    StorageInitializationContract::initialize(env.clone(), admin.clone(), config.clone());
    
    let state = StorageInitializationContract::get_initialization_state(env.clone());
    assert_eq!(state, InitializationState::Initialized);
}
