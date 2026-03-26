use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{IterationOptimizationContract, BatchStatus, SortDirection, IteratorStatus};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let version = IterationOptimizationContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_process_large_dataset() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let processor = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let batch_id = IterationOptimizationContract::process_large_dataset(
        env.clone(),
        Symbol::new(&env, "test_dataset"),
        1000,  // total_items
        100,    // batch_size
        processor.clone(),
    );
    
    let batch_data = IterationOptimizationContract::get_batch_data(env.clone(), batch_id.clone());
    assert_eq!(batch_data.total_items, 1000);
    assert_eq!(batch_data.batch_size, 100);
    assert_eq!(batch_data.status, BatchStatus::Pending);
    assert_eq!(batch_data.processed_items, 0);
}

#[test]
fn test_process_batch() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let processor = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let batch_id = IterationOptimizationContract::process_large_dataset(
        env.clone(),
        Symbol::new(&env, "test_dataset"),
        50,    // total_items
        10,    // batch_size
        processor.clone(),
    );
    
    // Process first batch
    let completed = IterationOptimizationContract::process_batch(env.clone(), batch_id.clone());
    assert!(!completed); // Should not be completed yet
    
    let batch_data = IterationOptimizationContract::get_batch_data(env.clone(), batch_id.clone());
    assert_eq!(batch_data.processed_items, 10);
    assert_eq!(batch_data.current_batch, 1);
    assert_eq!(batch_data.status, BatchStatus::Pending);
    
    // Process remaining batches
    let mut all_completed = false;
    for _ in 1..5 { // Should take 5 batches total
        all_completed = IterationOptimizationContract::process_batch(env.clone(), batch_id.clone());
        if all_completed {
            break;
        }
    }
    
    assert!(all_completed);
    
    let final_batch_data = IterationOptimizationContract::get_batch_data(env.clone(), batch_id.clone());
    assert_eq!(final_batch_data.processed_items, 50);
    assert_eq!(final_batch_data.status, BatchStatus::Completed);
    assert!(final_batch_data.completed_at.is_some());
}

#[test]
fn test_create_pagination() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let pagination_id = IterationOptimizationContract::create_pagination(
        env.clone(),
        Symbol::new(&env, "test_dataset"),
        1000,  // total_items
        50,    // page_size
        Symbol::new(&env, "created_at"),
        SortDirection::Ascending,
    );
    
    let pagination_state = IterationOptimizationContract::get_pagination_state(env.clone(), pagination_id.clone());
    assert_eq!(pagination_state.total_items, 1000);
    assert_eq!(pagination_state.page_size, 50);
    assert_eq!(pagination_state.total_pages, 20);
    assert_eq!(pagination_state.current_page, 0);
    assert!(pagination_state.has_next);
    assert!(!pagination_state.has_previous);
}

#[test]
fn test_get_page() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let pagination_id = IterationOptimizationContract::create_pagination(
        env.clone(),
        Symbol::new(&env, "test_dataset"),
        100,   // total_items
        25,    // page_size
        Symbol::new(&env, "id"),
        SortDirection::Ascending,
    );
    
    // Get first page
    let page1 = IterationOptimizationContract::get_page(env.clone(), pagination_id.clone(), 0);
    assert_eq!(page1.len(), 25);
    assert_eq!(page1.get(0), Some(&0));
    assert_eq!(page1.get(24), Some(&24));
    
    // Get second page
    let page2 = IterationOptimizationContract::get_page(env.clone(), pagination_id.clone(), 1);
    assert_eq!(page2.len(), 25);
    assert_eq!(page2.get(0), Some(&25));
    assert_eq!(page2.get(24), Some(&49));
    
    // Get last page (partial)
    let last_page = IterationOptimizationContract::get_page(env.clone(), pagination_id.clone(), 3);
    assert_eq!(last_page.len(), 25);
    assert_eq!(last_page.get(0), Some(&75));
    assert_eq!(last_page.get(24), Some(&99));
}

#[test]
fn test_safe_iterate() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let iterator_id = BytesN::from_array(&env, &[1; 32]);
    let total_iterations = 100;
    let max_iterations_per_call = 25;
    
    // First iteration batch
    let (processed1, completed1) = IterationOptimizationContract::safe_iterate(
        env.clone(),
        iterator_id.clone(),
        total_iterations,
        max_iterations_per_call,
    );
    
    assert_eq!(processed1, 25);
    assert!(!completed1);
    
    let iterator_state1 = IterationOptimizationContract::get_iterator_state(env.clone(), iterator_id.clone());
    assert_eq!(iterator_state1.current_position, 25);
    assert_eq!(iterator_state1.items_processed, 25);
    assert_eq!(iterator_state1.status, IteratorStatus::Active);
    
    // Second iteration batch
    let (processed2, completed2) = IterationOptimizationContract::safe_iterate(
        env.clone(),
        iterator_id.clone(),
        total_iterations,
        max_iterations_per_call,
    );
    
    assert_eq!(processed2, 25);
    assert!(!completed2);
    
    let iterator_state2 = IterationOptimizationContract::get_iterator_state(env.clone(), iterator_id.clone());
    assert_eq!(iterator_state2.current_position, 50);
    assert_eq!(iterator_state2.items_processed, 50);
    
    // Continue until completion
    let mut all_completed = false;
    for _ in 2..4 { // Should take 4 batches total
        let (_, completed) = IterationOptimizationContract::safe_iterate(
            env.clone(),
            iterator_id.clone(),
            total_iterations,
            max_iterations_per_call,
        );
        if completed {
            all_completed = true;
            break;
        }
    }
    
    assert!(all_completed);
    
    let final_state = IterationOptimizationContract::get_iterator_state(env.clone(), iterator_id.clone());
    assert_eq!(final_state.status, IteratorStatus::Completed);
    assert_eq!(final_state.items_processed, 100);
}

#[test]
fn test_batch_process_with_gas_management() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let items = vec![
        &env, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20
    ];
    
    let (total_processed, batch_ids) = IterationOptimizationContract::batch_process_with_gas_management(
        env.clone(),
        items.clone(),
        5,      // batch_size
        100000, // gas_limit_per_batch
    );
    
    assert_eq!(total_processed, 20);
    assert_eq!(batch_ids.len(), 4); // 20 items / 5 per batch = 4 batches
}

#[test]
fn test_optimize_loop() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let metrics = IterationOptimizationContract::optimize_loop(
        env.clone(),
        Symbol::new(&env, "test_operation"),
        100, // iterations
    );
    
    assert_eq!(metrics.operation_type, Symbol::new(&env, "test_operation"));
    assert_eq!(metrics.total_iterations, 100);
    assert!(metrics.iterations_completed > 0);
    assert!(metrics.gas_used > 0);
}

#[test]
fn test_loop_config() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let config = IterationOptimizationContract::get_loop_config(env.clone());
    assert_eq!(config.max_iterations, 1000);
    assert_eq!(config.batch_size, 100);
    assert!(config.pagination_enabled);
    assert!(config.gas_monitoring_enabled);
    
    // Update config
    let new_config = crate::LoopConfig {
        max_iterations: 500,
        gas_limit_per_iteration: 25000,
        total_gas_limit: 25000000,
        batch_size: 50,
        pagination_enabled: false,
        gas_monitoring_enabled: true,
        auto_break_on_gas_limit: true,
    };
    
    IterationOptimizationContract::update_loop_config(env.clone(), new_config.clone());
    
    let updated_config = IterationOptimizationContract::get_loop_config(env.clone());
    assert_eq!(updated_config.max_iterations, 500);
    assert_eq!(updated_config.batch_size, 50);
    assert!(!updated_config.pagination_enabled);
}

#[test]
fn test_gas_metrics() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    let metrics = IterationOptimizationContract::optimize_loop(
        env.clone(),
        Symbol::new(&env, "gas_test"),
        50, // iterations
    );
    
    let retrieved_metrics = IterationOptimizationContract::get_gas_metrics(env.clone(), metrics.operation_id);
    assert_eq!(retrieved_metrics.operation_type, Symbol::new(&env, "gas_test"));
    assert_eq!(retrieved_metrics.total_iterations, 50);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    IterationOptimizationContract::initialize(env.clone(), admin.clone());
    
    // Pause contract
    IterationOptimizationContract::pause(env.clone());
    
    // Unpause contract
    IterationOptimizationContract::unpause(env.clone());
}
