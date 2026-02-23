use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{MultisigWalletContract, WalletConfig, Role, TransactionStatus, BatchStatus};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    let config = WalletConfig {
        m: 2, // Require 2 signatures
        n: 3, // Total 3 signers
        daily_spending_limit: 1000000000, // 100 XLM
        timelock_threshold: 500000000,     // 50 XLM
        timelock_duration: 86400,          // 24 hours
        transaction_expiry: 604800,        // 7 days
        max_batch_size: 10,
        emergency_freeze_duration: 3600,   // 1 hour
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config.clone(),
        vec![&env, signer1.clone(), signer2.clone(), signer3.clone()],
    );
    
    let stored_config = MultisigWalletContract::get_config(env.clone());
    assert_eq!(stored_config.m, config.m);
    assert_eq!(stored_config.n, config.n);
    assert_eq!(stored_config.daily_spending_limit, config.daily_spending_limit);
}

#[test]
fn test_add_signer() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let new_signer = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 2,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    MultisigWalletContract::add_signer(
        env.clone(),
        new_signer.clone(),
        Role::Treasurer,
        1,
    );
    
    let signers = MultisigWalletContract::get_signers(env.clone());
    assert_eq!(signers.len(), 2);
    
    let treasurer = signers.iter().find(|s| s.address == new_signer).unwrap();
    assert!(matches!(treasurer.role, Role::Treasurer));
}

#[test]
fn test_propose_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        10000000, // 1 XLM
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    let transaction = MultisigWalletContract::get_transaction(env.clone(), transaction_id);
    assert_eq!(transaction.to, recipient);
    assert_eq!(transaction.amount, 10000000);
    assert_eq!(transaction.status, TransactionStatus::Proposed);
}

#[test]
fn test_sign_and_execute_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        10000000,
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    // Sign transaction
    MultisigWalletContract::sign_transaction(env.clone(), transaction_id, signer1.clone());
    
    // Check if approved
    let transaction = MultisigWalletContract::get_transaction(env.clone(), transaction_id);
    assert_eq!(transaction.status, TransactionStatus::Approved);
    
    // Execute transaction
    MultisigWalletContract::execute_transaction(env.clone(), transaction_id);
    
    let transaction = MultisigWalletContract::get_transaction(env.clone(), transaction_id);
    assert_eq!(transaction.status, TransactionStatus::Executed);
}

#[test]
fn test_timelock_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 10000000, // 1 XLM
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        10000000, // Exactly at threshold
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    let transaction = MultisigWalletContract::get_transaction(env.clone(), transaction_id);
    assert!(transaction.timelock_until > 0);
    
    // Sign transaction
    MultisigWalletContract::sign_transaction(env.clone(), transaction_id, signer1.clone());
    
    // Try to execute before timelock expires (should fail)
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), transaction_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_batch_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    // Create multiple transactions
    let tx1_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient1.clone(),
        token.clone(),
        10000000,
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    let tx2_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient2.clone(),
        token.clone(),
        20000000,
        Vec::new(&env),
        signer1.clone(),
        2,
    );
    
    // Create batch
    let batch_id = MultisigWalletContract::propose_batch(
        env.clone(),
        vec![&env, tx1_id.clone(), tx2_id.clone()],
        signer1.clone(),
        3,
    );
    
    // Sign batch
    MultisigWalletContract::sign_batch(env.clone(), batch_id, signer1.clone());
    
    // Execute batch
    MultisigWalletContract::execute_batch(env.clone(), batch_id);
    
    let batch = MultisigWalletContract::get_batch(env.clone(), batch_id);
    assert_eq!(batch.status, BatchStatus::Executed);
    
    let tx1 = MultisigWalletContract::get_transaction(env.clone(), tx1_id);
    let tx2 = MultisigWalletContract::get_transaction(env.clone(), tx2_id);
    assert_eq!(tx1.status, TransactionStatus::Executed);
    assert_eq!(tx2.status, TransactionStatus::Executed);
}

#[test]
fn test_daily_spending_limit() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 50000000, // 5 XLM
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    // First transaction within limit
    let tx1_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        30000000, // 3 XLM
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    MultisigWalletContract::sign_transaction(env.clone(), tx1_id, signer1.clone());
    MultisigWalletContract::execute_transaction(env.clone(), tx1_id);
    
    // Check daily spending
    let daily_spending = MultisigWalletContract::get_daily_spending(env.clone());
    assert_eq!(daily_spending.spent, 30000000);
    
    // Second transaction would exceed limit
    let tx2_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        30000000, // 3 XLM
        Vec::new(&env),
        signer1.clone(),
        2,
    );
    
    MultisigWalletContract::sign_transaction(env.clone(), tx2_id, signer1.clone());
    
    // Should fail due to daily spending limit
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), tx2_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_emergency_freeze() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    // Initially not frozen
    assert!(!MultisigWalletContract::is_frozen(env.clone()));
    
    // Emergency freeze
    MultisigWalletContract::emergency_freeze(env.clone(), 3600);
    
    // Should be frozen
    assert!(MultisigWalletContract::is_frozen(env.clone()));
    
    // Try to propose transaction (should fail)
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::propose_transaction(
            env.clone(),
            Address::generate(&env),
            Address::generate(&env),
            10000000,
            Vec::new(&env),
            signer1.clone(),
            1,
        );
    });
    assert!(result.is_err());
    
    // Unfreeze
    MultisigWalletContract::unfreeze(env.clone());
    
    // Should not be frozen
    assert!(!MultisigWalletContract::is_frozen(env.clone()));
}

#[test]
fn test_remove_signer() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    let config = WalletConfig {
        m: 2,
        n: 3,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone(), signer2.clone(), signer3.clone()],
    );
    
    // Remove one signer
    MultisigWalletContract::remove_signer(env.clone(), signer3.clone());
    
    let signers = MultisigWalletContract::get_signers(env.clone());
    assert_eq!(signers.len(), 2);
    
    // Should not contain removed signer
    assert!(!signers.iter().any(|s| s.address == signer3));
}

#[test]
fn test_nonce_validation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token = Address::generate(&env);
    
    let config = WalletConfig {
        m: 1,
        n: 1,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config,
        vec![&env, signer1.clone()],
    );
    
    // First transaction with nonce 1
    MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        10000000,
        Vec::new(&env),
        signer1.clone(),
        1,
    );
    
    // Try to use same nonce again (should fail)
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::propose_transaction(
            env.clone(),
            recipient.clone(),
            token.clone(),
            10000000,
            Vec::new(&env),
            signer1.clone(),
            1,
        );
    });
    assert!(result.is_err());
    
    // Try to use lower nonce (should fail)
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::propose_transaction(
            env.clone(),
            recipient.clone(),
            token.clone(),
            10000000,
            Vec::new(&env),
            signer1.clone(),
            0,
        );
    });
    assert!(result.is_err());
    
    // Higher nonce should work
    MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.clone(),
        10000000,
        Vec::new(&env),
        signer1.clone(),
        2,
    );
}
