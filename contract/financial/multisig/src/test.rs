use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env, Symbol, Vec, Map,
};
use soroban_sdk::symbol_short;
use crate::{
    MultisigWalletContract, WalletConfig, Role, TransactionStatus, BatchStatus, 
    Transaction, Signer, Batch, TimelockQueue, DailySpending, NonceManager, MultisigError
};

fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    token::Client::new(env, &contract_id.address())
}

fn create_test_config() -> WalletConfig {
    WalletConfig {
        m: 2, // Require 2 signatures
        n: 3, // Total 3 signers
        daily_spending_limit: 1000000000, // 100 XLM
        timelock_threshold: 500000000,     // 50 XLM
        timelock_duration: 86400,          // 24 hours
        transaction_expiry: 604800,        // 7 days
        max_batch_size: 10,
        emergency_freeze_duration: 3600,   // 1 hour
    }
}

fn setup_multisig_wallet(env: &Env) -> (Address, token::Client<'_>, Vec<Address>) {
    let admin = Address::generate(env);
    let signer1 = Address::generate(env);
    let signer2 = Address::generate(env);
    let signer3 = Address::generate(env);
    let token = create_token_contract(env, &admin);
    
    let signers = vec![env, signer1.clone(), signer2.clone(), signer3.clone()];
    
    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        create_test_config(),
        signers.clone(),
    );
    
    (admin, token, signers)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    let signer3 = Address::generate(&env);
    
    let config = create_test_config();
    let signers = vec![&env, signer1.clone(), signer2.clone(), signer3.clone()];

    MultisigWalletContract::initialize(
        env.clone(),
        admin.clone(),
        config.clone(),
        signers.clone(),
    );
    
    let stored_config = MultisigWalletContract::get_config(env.clone());
    assert_eq!(stored_config.m, config.m);
    assert_eq!(stored_config.n, config.n);
    assert_eq!(stored_config.daily_spending_limit, config.daily_spending_limit);
    
    assert_eq!(MultisigWalletContract::version(env), 1);
    assert!(!MultisigWalletContract::is_paused(env.clone()));
    assert!(!MultisigWalletContract::is_frozen(env));
    
    let all_signers = MultisigWalletContract::get_signers(env);
    assert_eq!(all_signers.len(), 3);
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let config = create_test_config();
    let signers = vec![&env, signer1.clone(), signer2.clone()];

    MultisigWalletContract::initialize(env.clone(), admin.clone(), config.clone(), signers.clone());
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::initialize(env, admin, config, signers);
    });
    assert!(result.is_err());
}

#[test]
fn test_add_signer() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let new_signer = Address::generate(&env);
    
    MultisigWalletContract::add_signer(env.clone(), new_signer.clone(), Role::Owner, 1);
    
    let all_signers = MultisigWalletContract::get_signers(env);
    assert_eq!(all_signers.len(), 4);
    
    let new_signer_info = MultisigWalletContract::get_signer(env, new_signer);
    assert_eq!(new_signer_info.role, Role::Owner);
    assert_eq!(new_signer_info.weight, 1);
}

#[test]
fn test_add_signer_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let unauthorized = Address::generate(&env);
    let new_signer = Address::generate(&env);
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::add_signer(env.clone(), new_signer, Role::Owner, 1);
    });
    assert!(result.is_err());
}

#[test]
fn test_remove_signer() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let signer_to_remove = signers.remove(0);
    
    MultisigWalletContract::remove_signer(env.clone(), signer_to_remove.clone());
    
    let all_signers = MultisigWalletContract::get_signers(env);
    assert_eq!(all_signers.len(), 2);
    
    let result = MultisigWalletContract::try_get_signer(env, signer_to_remove);
    assert!(result.is_err());
}

#[test]
fn test_remove_signer_would_make_m_greater_than_n() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let signer1 = Address::generate(&env);
    let signer2 = Address::generate(&env);
    
    let config = WalletConfig {
        m: 2,
        n: 2,
        daily_spending_limit: 1000000000,
        timelock_threshold: 500000000,
        timelock_duration: 86400,
        transaction_expiry: 604800,
        max_batch_size: 10,
        emergency_freeze_duration: 3600,
    };
    
    let signers = vec![&env, signer1.clone(), signer2.clone()];
    MultisigWalletContract::initialize(env.clone(), admin.clone(), config, signers);
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::remove_signer(env.clone(), signer1);
    });
    assert!(result.is_err());
}

#[test]
fn test_propose_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000, // 0.001 XLM
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    let transaction = MultisigWalletContract::get_transaction(env, transaction_id);
    assert_eq!(transaction.to, recipient);
    assert_eq!(transaction.amount, 1000000);
    assert_eq!(transaction.proposer, proposer);
    assert_eq!(transaction.status, TransactionStatus::Pending);
}

#[test]
fn test_propose_transaction_with_timelock() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000000, // 1 XLM - above timelock threshold
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    let transaction = MultisigWalletContract::get_transaction(env, transaction_id);
    assert!(transaction.timelock_until > 0);
}

#[test]
fn test_propose_transaction_invalid_nonce() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    // First transaction with nonce 1
    MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    // Second transaction with same nonce should fail
    let result = MultisigWalletContract::try_propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    );
    assert_eq!(result, Err(MultisigError::NonceUsed));
}

#[test]
fn test_approve_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let approver = signers.get(1).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id.clone(), approver.clone());
    
    let transaction = MultisigWalletContract::get_transaction(env, transaction_id);
    assert!(transaction.approvals.contains(&approver));
    assert_eq!(transaction.status, TransactionStatus::Pending); // Still pending, needs 2 approvals
}

#[test]
fn test_execute_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let proposer = signers.remove(0);
    let approver = signers.remove(0);
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let recipient_balance_before = token.balance(&recipient);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id.clone(), approver.clone());
    
    // Execute the transaction (anyone can call execute)
    MultisigWalletContract::execute_transaction(env.clone(), transaction_id.clone());
    
    let transaction = MultisigWalletContract::get_transaction(env, transaction_id);
    assert_eq!(transaction.status, TransactionStatus::Executed);
    
    assert_eq!(token.balance(&recipient), recipient_balance_before + 1000000);
}

#[test]
fn test_execute_transaction_before_approval_threshold() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), transaction_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_create_batch() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transactions = Vec::from_array(&env, [
        (recipient1.clone(), token.address(), 1000000, Vec::new(&env)),
        (recipient2.clone(), token.address(), 2000000, Vec::new(&env)),
    ]);
    
    let batch_id = MultisigWalletContract::create_batch(
        env.clone(),
        transactions,
        proposer.clone(),
        1,
    ).unwrap();
    
    let batch = MultisigWalletContract::get_batch(env, batch_id);
    assert_eq!(batch.transactions.len(), 2);
    assert_eq!(batch.proposer, proposer);
    assert_eq!(batch.status, BatchStatus::Pending);
}

#[test]
fn test_approve_and_execute_batch() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let proposer = signers.remove(0);
    let approver = signers.remove(0);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let recipient1_balance_before = token.balance(&recipient1);
    let recipient2_balance_before = token.balance(&recipient2);
    
    let transactions = Vec::from_array(&env, [
        (recipient1.clone(), token.address(), 1000000, Vec::new(&env)),
        (recipient2.clone(), token.address(), 2000000, Vec::new(&env)),
    ]);
    
    let batch_id = MultisigWalletContract::create_batch(
        env.clone(),
        transactions,
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_batch(env.clone(), batch_id.clone(), approver.clone());
    MultisigWalletContract::execute_batch(env.clone(), batch_id.clone());
    
    let batch = MultisigWalletContract::get_batch(env, batch_id);
    assert_eq!(batch.status, BatchStatus::Executed);
    
    assert_eq!(token.balance(&recipient1), recipient1_balance_before + 1000000);
    assert_eq!(token.balance(&recipient2), recipient2_balance_before + 2000000);
}

#[test]
fn test_daily_spending_limit() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let proposer = signers.remove(0);
    let approver = signers.remove(0);
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &2000000000);
    
    // First transaction within daily limit
    let transaction_id1 = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        500000000, // 50 XLM
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id1.clone(), approver.clone());
    MultisigWalletContract::execute_transaction(env.clone(), transaction_id1.clone());
    
    // Second transaction would exceed daily limit
    let transaction_id2 = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        600000000, // 60 XLM
        Vec::new(&env),
        proposer.clone(),
        2,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id2.clone(), approver.clone());
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), transaction_id2);
    });
    assert!(result.is_err());
}

#[test]
fn test_pause_and_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    
    assert!(!MultisigWalletContract::is_paused(env.clone()));
    
    MultisigWalletContract::pause(env.clone(), admin.clone());
    assert!(MultisigWalletContract::is_paused(env.clone()));
    
    MultisigWalletContract::unpause(env.clone(), admin.clone());
    assert!(!MultisigWalletContract::is_paused(env));
}

#[test]
fn test_emergency_freeze() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    
    assert!(!MultisigWalletContract::is_frozen(env.clone()));
    
    MultisigWalletContract::emergency_freeze(env.clone(), admin.clone());
    assert!(MultisigWalletContract::is_frozen(env.clone()));
    
    // Should not be able to propose transactions when frozen
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::propose_transaction(
            env.clone(),
            recipient,
            token.address(),
            1000000,
            Vec::new(&env),
            proposer,
            1,
        );
    });
    assert!(result.is_err());
}

#[test]
fn test_timelock_execution() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let proposer = signers.remove(0);
    let approver = signers.remove(0);
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000000, // Above timelock threshold
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id.clone(), approver.clone());
    
    // Try to execute before timelock expires - should fail
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), transaction_id);
    });
    assert!(result.is_err());
    
    // Advance time past timelock
    let mut ledger = env.ledger().get();
    ledger.timestamp += 86400 + 1; // 24 hours + 1 second
    env.ledger().set(ledger);
    
    // Now execution should succeed
    MultisigWalletContract::execute_transaction(env.clone(), transaction_id.clone());
    
    let transaction = MultisigWalletContract::get_transaction(env, transaction_id);
    assert_eq!(transaction.status, TransactionStatus::Executed);
}

#[test]
fn test_transaction_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    // Advance time past expiry
    let mut ledger = env.ledger().get();
    ledger.timestamp += 604800 + 1; // 7 days + 1 second
    env.ledger().set(ledger);
    
    let result = std::panic::catch_unwind(|| {
        MultisigWalletContract::execute_transaction(env.clone(), transaction_id);
    });
    assert!(result.is_err());
}

#[test]
fn test_nonce_management() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    // Use nonces sequentially
    for i in 1..=5 {
        MultisigWalletContract::propose_transaction(
            env.clone(),
            recipient.clone(),
            token.address(),
            1000000,
            Vec::new(&env),
            proposer.clone(),
            i,
        ).unwrap();
    }
    
    // Try to reuse a nonce should fail
    let result = MultisigWalletContract::try_propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        3,
    );
    assert_eq!(result, Err(MultisigError::NonceUsed));
}

#[test]
fn test_upgrade_management() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    
    let new_wasm_hash = BytesN::from_array(&env, &[1; 32]);
    let unlock_time = env.ledger().timestamp() + 1000;
    
    MultisigWalletContract::schedule_upgrade(env.clone(), admin.clone(), new_wasm_hash.clone(), unlock_time);
    
    let mut ledger = env.ledger().get();
    ledger.timestamp = unlock_time + 1;
    env.ledger().set(ledger);
    
    MultisigWalletContract::execute_upgrade(env.clone(), admin.clone(), new_wasm_hash);
    MultisigWalletContract::migrate_state(env, admin.clone(), 2);
    
    assert_eq!(MultisigWalletContract::version(env), 2);
}

#[test]
fn test_edge_case_zero_amount_transaction() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    let recipient = Address::generate(&env);
    
    let result = MultisigWalletContract::try_propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        0, // Zero amount
        Vec::new(&env),
        proposer.clone(),
        1,
    );
    assert!(result.is_err());
}

#[test]
fn test_edge_case_max_batch_size() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, signers) = setup_multisig_wallet(&env);
    let proposer = signers.get(0).unwrap().clone();
    
    // Create a batch with more transactions than max_batch_size
    let mut transactions = Vec::new(&env);
    for _ in 0..15 { // More than max_batch_size of 10
        transactions.push_back((Address::generate(&env), token.address(), 1000000, Vec::new(&env)));
    }
    
    let result = MultisigWalletContract::try_create_batch(
        env.clone(),
        transactions,
        proposer.clone(),
        1,
    );
    assert!(result.is_err());
}

#[test]
fn test_reentrancy_protection() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (admin, token, mut signers) = setup_multisig_wallet(&env);
    let proposer = signers.remove(0);
    let approver = signers.remove(0);
    let recipient = Address::generate(&env);
    
    let token_admin = token::StellarAssetClient::new(&env, &token.address);
    token_admin.mint(&MultisigWalletContract::address(env.clone()), &1000000000);
    
    let transaction_id = MultisigWalletContract::propose_transaction(
        env.clone(),
        recipient.clone(),
        token.address(),
        1000000,
        Vec::new(&env),
        proposer.clone(),
        1,
    ).unwrap();
    
    MultisigWalletContract::approve_transaction(env.clone(), transaction_id.clone(), approver.clone());
    MultisigWalletContract::execute_transaction(env, transaction_id);
}
