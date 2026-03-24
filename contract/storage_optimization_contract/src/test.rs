use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{StorageOptimizationContract, flags, pack_counts, unpack_login_count, unpack_transaction_count};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    let version = StorageOptimizationContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_store_user_data_optimized() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let metadata = BytesN::from_array(&env, &[1; 16]);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    StorageOptimizationContract::store_user_data_optimized(
        env.clone(),
        user.clone(),
        true,   // active
        true,   // verified
        false,  // premium
        10,     // login_count
        5,      // transaction_count
        1000,   // amount
        metadata.clone(),
    );
    
    let user_data = StorageOptimizationContract::get_user_data(env.clone(), user.clone());
    assert_eq!(user_data.user, user);
    assert_eq!(user_data.amounts, 1000);
    assert_eq!(user_data.metadata, metadata);
    
    // Check flags
    assert!(StorageOptimizationContract::check_user_flag(env.clone(), user.clone(), flags::ACTIVE));
    assert!(StorageOptimizationContract::check_user_flag(env.clone(), user.clone(), flags::VERIFIED));
    assert!(!StorageOptimizationContract::check_user_flag(env.clone(), user.clone(), flags::PREMIUM));
}

#[test]
fn test_batch_store_users() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    let users = vec![&env, user1.clone(), user2.clone()];
    let flags = vec![&env, 1, 2];
    let counts = vec![&env, pack_counts(10, 5), pack_counts(20, 10)];
    let amounts = vec![&env, 1000, 2000];
    let metadata = vec![&env, BytesN::from_array(&env, &[1; 16]), BytesN::from_array(&env, &[2; 16])];
    
    let batch_id = StorageOptimizationContract::batch_store_users(
        env.clone(),
        users.clone(),
        flags.clone(),
        counts.clone(),
        amounts.clone(),
        metadata.clone(),
    );
    
    // Verify users were stored
    let user1_data = StorageOptimizationContract::get_user_data(env.clone(), user1.clone());
    assert_eq!(user1_data.amounts, 1000);
    
    let user2_data = StorageOptimizationContract::get_user_data(env.clone(), user2.clone());
    assert_eq!(user2_data.amounts, 2000);
}

#[test]
fn test_cache_operations() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let key = BytesN::from_array(&env, &[1; 32]);
    let value = BytesN::from_array(&env, &[2; 32]);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Cache data
    StorageOptimizationContract::cache_data(env.clone(), key.clone(), value.clone(), 3600);
    
    // Retrieve cached data
    let cached_value = StorageOptimizationContract::get_cached_data(env.clone(), key.clone());
    assert_eq!(cached_value, Some(value));
    
    // Test non-existent key
    let non_existent_key = BytesN::from_array(&env, &[3; 32]);
    let non_existent_value = StorageOptimizationContract::get_cached_data(env.clone(), non_existent_key.clone());
    assert_eq!(non_existent_value, None);
}

#[test]
fn test_packing_utilities() {
    let env = Env::default();
    
    // Test packing and unpacking counts
    let login_count = 100;
    let transaction_count = 50;
    let packed = pack_counts(login_count, transaction_count);
    
    let unpacked_login = unpack_login_count(packed);
    let unpacked_transaction = unpack_transaction_count(packed);
    
    assert_eq!(unpacked_login, login_count);
    assert_eq!(unpacked_transaction, transaction_count);
}

#[test]
fn test_update_user_data() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let metadata = BytesN::from_array(&env, &[1; 16]);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Store initial data
    StorageOptimizationContract::store_user_data_optimized(
        env.clone(),
        user.clone(),
        true,   // active
        false,  // verified
        false,  // premium
        10,     // login_count
        5,      // transaction_count
        1000,   // amount
        metadata.clone(),
    );
    
    // Update user data
    StorageOptimizationContract::update_user_data(
        env.clone(),
        user.clone(),
        Some(true),      // keep active
        Some(true),      // set verified
        Some(true),      // set premium
        Some(5),         // add 5 logins
        Some(3),         // add 3 transactions
        Some(500),       // add 500 amount
    );
    
    // Verify updates
    let updated_data = StorageOptimizationContract::get_user_data(env.clone(), user.clone());
    assert_eq!(updated_data.amounts, 1500); // 1000 + 500
    assert!(StorageOptimizationContract::check_user_flag(env.clone(), user.clone(), flags::VERIFIED));
    assert!(StorageOptimizationContract::check_user_flag(env.clone(), user.clone(), flags::PREMIUM));
    
    let (login_count, transaction_count) = StorageOptimizationContract::get_user_counts(env.clone(), user.clone());
    assert_eq!(login_count, 15); // 10 + 5
    assert_eq!(transaction_count, 8); // 5 + 3
}

#[test]
fn test_storage_metrics() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let metadata = BytesN::from_array(&env, &[1; 16]);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Check initial metrics
    let metrics = StorageOptimizationContract::get_storage_metrics(env.clone());
    assert_eq!(metrics.total_entries, 0);
    assert_eq!(metrics.storage_writes, 0);
    
    // Store user data
    StorageOptimizationContract::store_user_data_optimized(
        env.clone(),
        user.clone(),
        true,
        false,
        true,
        10,
        5,
        1000,
        metadata.clone(),
    );
    
    // Check updated metrics
    let updated_metrics = StorageOptimizationContract::get_storage_metrics(env.clone());
    assert_eq!(updated_metrics.total_entries, 1);
    assert_eq!(updated_metrics.storage_writes, 1);
}

#[test]
fn test_compact_map() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    let map_id = Symbol::new(&env, "test_map");
    let keys = vec![&env, BytesN::from_array(&env, &[1; 16]), BytesN::from_array(&env, &[2; 16])];
    let values = vec![&env, 100, 200];
    let timestamps = vec![&env, 1640995200, 1640995300];
    
    StorageOptimizationContract::store_compact_map(
        env.clone(),
        map_id.clone(),
        keys.clone(),
        values.clone(),
        timestamps.clone(),
    );
}

#[test]
fn test_benchmark_storage() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Benchmark store operation
    let benchmark = StorageOptimizationContract::benchmark_storage(env.clone(), Symbol::new(&env, "store"));
    assert_eq!(benchmark.operation, Symbol::new(&env, "store"));
    
    // Benchmark batch operation
    let batch_benchmark = StorageOptimizationContract::benchmark_storage(env.clone(), Symbol::new(&env, "batch"));
    assert_eq!(batch_benchmark.operation, Symbol::new(&env, "batch"));
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    StorageOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Pause contract
    StorageOptimizationContract::pause(env.clone());
    
    // Unpause contract
    StorageOptimizationContract::unpause(env.clone());
}
