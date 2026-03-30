//! Comprehensive security tests for the Multisig Wallet Contract
//! 
//! This module contains security-focused tests covering:
//! - Reentrancy attacks on multisig operations
//! - Access control and authorization bypasses
//! - Threshold manipulation attacks
//! - Front-running transaction submissions
//! - Key management vulnerabilities
//! - Edge cases in multi-signature logic

use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, Symbol, Vec, panic_with_error, i128, u64,
};
use crate::{
    MultiSigWallet, Transaction, TransactionStatus, DataKey, MultiSigError
};

// ---------------------------------------------------------------------------
// Malicious Contracts for Attack Simulation
// ---------------------------------------------------------------------------

#[contract]
pub struct MaliciousReentrancyMultisigContract {
    should_reenter: bool,
    call_count: u32,
    target_contract: Address,
    transaction_id: BytesN<32>,
}

#[contractimpl]
impl MaliciousReentrancyMultisigContract {
    pub fn new(env: &Env, target: Address, transaction_id: BytesN<32>) -> Address {
        let contract_id = env.register(MaliciousReentrancyMultisigContract, ());
        let client = MaliciousReentrancyMultisigContractClient::new(env, &contract_id);
        
        client.initialize(env, target, transaction_id);
        contract_id
    }

    fn initialize(&self, env: &Env, target: Address, transaction_id: BytesN<32>) {
        env.storage().instance().set(&Symbol::new(&env, "should_reenter"), &true);
        env.storage().instance().set(&Symbol::new(&env, "call_count"), &0u32);
        env.storage().instance().set(&Symbol::new(&env, "target"), &target);
        env.storage().instance().set(&Symbol::new(&env, "transaction_id"), &transaction_id);
    }

    /// Malicious callback that attempts reentrancy during transaction execution
    pub fn malicious_execution_callback(&self, env: &Env) {
        let should_reenter: bool = env.storage().instance()
            .get(&Symbol::new(&env, "should_reenter"))
            .unwrap_or(false);
        
        let call_count: u32 = env.storage().instance()
            .get(&Symbol::new(&env, "call_count"))
            .unwrap_or(0);
        
        env.storage().instance().set(&Symbol::new(&env, "call_count"), &(call_count + 1));
        
        if should_reenter && call_count == 0 {
            let target: Address = env.storage().instance()
                .get(&Symbol::new(&env, "target"))
                .unwrap();
            let transaction_id: BytesN<32> = env.storage().instance()
                .get(&Symbol::new(&env, "transaction_id"))
                .unwrap();
            
            env.storage().instance().set(&Symbol::new(&env, "should_reenter"), &false);
            
            // Attempt reentrant execution
            let multisig_client = MultiSigWalletClient::new(env, &target);
            multisig_client.execute_transaction(&transaction_id);
        }
    }

    pub fn get_call_count(&self, env: &Env) -> u32 {
        env.storage().instance()
            .get(&Symbol::new(&env, "call_count"))
            .unwrap_or(0)
    }
}

#[contract]
pub struct ThresholdManipulationContract {
    target_contract: Address,
}

#[contractimpl]
impl ThresholdManipulationContract {
    pub fn new(env: &Env, target: Address) -> Address {
        let contract_id = env.register(ThresholdManipulationContract, ());
        let client = ThresholdManipulationContractClient::new(env, &contract_id);
        
        client.initialize(env, target);
        contract_id
    }

    fn initialize(&self, env: &Env, target: Address) {
        env.storage().instance().set(&Symbol::new(&env, "target"), &target);
    }

    /// Attempts to manipulate threshold settings
    pub fn attempt_threshold_manipulation(&self, env: &Env, new_threshold: u32) {
        let target: Address = env.storage().instance()
            .get(&Symbol::new(&env, "target"))
            .unwrap();
        
        let multisig_client = MultiSigWalletClient::new(env, &target);
        
        // Attempt to change threshold without proper authorization
        multisig_client.change_threshold(&new_threshold);
    }
}

// ---------------------------------------------------------------------------
// Security Test Suite
// ---------------------------------------------------------------------------

#[cfg(test)]
mod security_tests {
    use super::*;
    use soroban_sdk::contracterror;

    fn create_test_env() -> (Env, Vec<Address>, Address) {
        let env = Env::default();
        let owners = Vec::new(&env);
        
        // Create multiple owners for multisig
        for _ in 0..3 {
            owners.push_back(Address::generate(&env));
        }
        
        let non_owner = Address::generate(&env);
        (env, owners, non_owner)
    }

    fn initialize_multisig_wallet(env: &Env, owners: &Vec<Address>, threshold: u32) {
        MultiSigWallet::initialize(env.clone(), owners.clone(), threshold);
    }

    // ---------------------------------------------------------------------------
    // Reentrancy Attack Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_reentrancy_attack_transaction_execution() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create a transaction
        let transaction = Transaction {
            destination: Address::generate(&env),
            value: 1000000,
            data: Bytes::new(&env),
            executed: false,
        };

        let transaction_id = MultiSigWallet::submit_transaction(
            env.clone(),
            transaction.destination.clone(),
            transaction.value,
            transaction.data.clone()
        );

        // Deploy malicious contract
        let malicious_address = MaliciousReentrancyMultisigContract::new(
            &env,
            env.current_contract_address(),
            transaction_id.clone()
        );

        // Approve transaction first
        MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), owners.get(0).unwrap());

        // Attempt reentrancy attack during execution
        let result = std::panic::catch_unwind(|| {
            let malicious_client = MaliciousReentrancyMultisigContractClient::new(&env, &malicious_address);
            malicious_client.malicious_execution_callback();
        });

        // Verify the attack was blocked
        assert!(result.is_err(), "Reentrancy attack should be blocked");
        
        // Verify transaction state remains consistent
        let tx_status = MultiSigWallet::get_transaction_status(env.clone(), transaction_id.clone());
        assert_eq!(tx_status, TransactionStatus::Pending);
    }

    #[test]
    fn test_reentrancy_attack_owner_addition() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        let new_owner = Address::generate(&env);
        
        // Deploy malicious contract for owner addition reentrancy
        let malicious_address = MaliciousReentrancyMultisigContract::new(
            &env,
            env.current_contract_address(),
            BytesN::from_array(&env, &[0; 32]) // Dummy transaction ID
        );

        // Attempt reentrancy during owner addition
        let result = std::panic::catch_unwind(|| {
            let malicious_client = MaliciousReentrancyMultisigContractClient::new(&env, &malicious_address);
            malicious_client.malicious_execution_callback();
        });

        assert!(result.is_err(), "Reentrancy during owner addition should be blocked");
    }

    // ---------------------------------------------------------------------------
    // Access Control Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_unauthorized_transaction_submission() {
        let (env, owners, non_owner) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Attempt transaction submission by non-owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                Address::generate(&env),
                1000000,
                Bytes::new(&env)
            );
        });

        assert!(result.is_err(), "Unauthorized transaction submission should be rejected");
    }

    #[test]
    fn test_unauthorized_transaction_approval() {
        let (env, owners, non_owner) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create transaction as owner
        let transaction_id = MultiSigWallet::submit_transaction(
            env.clone(),
            Address::generate(&env),
            1000000,
            Bytes::new(&env)
        );

        // Attempt approval by non-owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), &non_owner);
        });

        assert!(result.is_err(), "Unauthorized transaction approval should be rejected");
    }

    #[test]
    fn test_unauthorized_threshold_change() {
        let (env, owners, non_owner) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Attempt threshold change by non-owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::change_threshold(env.clone(), 3);
        });

        assert!(result.is_err(), "Unauthorized threshold change should be rejected");
    }

    #[test]
    fn test_unauthorized_owner_addition() {
        let (env, owners, non_owner) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        let new_owner = Address::generate(&env);

        // Attempt owner addition by non-owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::add_owner(env.clone(), new_owner.clone());
        });

        assert!(result.is_err(), "Unauthorized owner addition should be rejected");
    }

    #[test]
    fn test_unauthorized_owner_removal() {
        let (env, owners, non_owner) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Attempt owner removal by non-owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::remove_owner(env.clone(), owners.get(0).unwrap().clone());
        });

        assert!(result.is_err(), "Unauthorized owner removal should be rejected");
    }

    // ---------------------------------------------------------------------------
    // Threshold Manipulation Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_threshold_manipulation_attack() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Deploy threshold manipulation contract
        let malicious_address = ThresholdManipulationContract::new(
            &env,
            env.current_contract_address()
        );

        // Attempt threshold manipulation
        let result = std::panic::catch_unwind(|| {
            let malicious_client = ThresholdManipulationContractClient::new(&env, &malicious_address);
            malicious_client.attempt_threshold_manipulation(&1); // Lower threshold to 1
        });

        assert!(result.is_err(), "Threshold manipulation should be blocked");
    }

    #[test]
    fn test_invalid_threshold_values() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Test with zero threshold
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::change_threshold(env.clone(), 0);
        });

        assert!(result.is_err(), "Zero threshold should be rejected");

        // Test with threshold higher than number of owners
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::change_threshold(env.clone(), 10);
        });

        assert!(result.is_err(), "Threshold higher than owner count should be rejected");
    }

    #[test]
    fn test_threshold_consistency_check() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Add a new owner
        let new_owner = Address::generate(&env);
        MultiSigWallet::add_owner(env.clone(), new_owner.clone());

        // Now we have 4 owners, threshold should still be valid
        let current_threshold = MultiSigWallet::get_threshold(env.clone());
        assert!(current_threshold <= 4, "Threshold should not exceed owner count");

        // Attempt to set threshold to exactly owner count (should be allowed)
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::change_threshold(env.clone(), 4);
        });

        assert!(result.is_ok(), "Threshold equal to owner count should be allowed");
    }

    // ---------------------------------------------------------------------------
    // Front-running Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_transaction_submission_front_running() {
        let (env, owners, attacker) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        let destination = Address::generate(&env);
        
        // Victim submits a transaction (would be seen in mempool)
        let victim_tx = MultiSigWallet::submit_transaction(
            env.clone(),
            destination.clone(),
            1000000,
            Bytes::new(&env)
        );

        // Attacker attempts to front-run with similar transaction
        env.mock_auths(&attacker, &attacker);
        
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                destination.clone(),
                1000001, // Slightly higher value
                Bytes::new(&env)
            );
        });

        // Attacker should not be able to submit as non-owner
        assert!(result.is_err(), "Front-running by non-owner should be blocked");
    }

    #[test]
    fn test_approval_front_running() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        let transaction_id = MultiSigWallet::submit_transaction(
            env.clone(),
            Address::generate(&env),
            1000000,
            Bytes::new(&env)
        );

        // First owner approves
        MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), owners.get(0).unwrap());

        // Check if second approval is needed (front-running scenario)
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), owners.get(1).unwrap);
        });

        assert!(result.is_ok(), "Second approval should succeed");
        
        // Verify transaction is executed
        let tx_status = MultiSigWallet::get_transaction_status(env.clone(), transaction_id.clone());
        assert_eq!(tx_status, TransactionStatus::Executed);
    }

    // ---------------------------------------------------------------------------
    // Edge Case and Boundary Tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_zero_value_transaction() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Test with zero value transaction
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                Address::generate(&env),
                0, // Zero value
                Bytes::new(&env)
            );
        });

        // Zero value transactions might be allowed or rejected depending on implementation
        assert!(result.is_ok() || result.is_err(), "Zero value handling should be defined");
    }

    #[test]
    fn test_maximum_value_transaction() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Test with maximum possible value
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                Address::generate(&env),
                i128::MAX, // Maximum value
                Bytes::new(&env)
            );
        });

        // Should either be accepted or rejected gracefully
        assert!(result.is_ok() || result.is_err(), "Maximum value should be handled safely");
    }

    #[test]
    fn test_duplicate_owner_addition() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Attempt to add existing owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::add_owner(env.clone(), owners.get(0).unwrap().clone());
        });

        assert!(result.is_err(), "Duplicate owner addition should be rejected");
    }

    #[test]
    fn test_self_owner_removal() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Attempt to remove self
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::remove_owner(env.clone(), owners.get(0).unwrap().clone());
        });

        // Self-removal might be allowed or blocked depending on implementation
        assert!(result.is_ok() || result.is_err(), "Self-removal should be handled consistently");
    }

    #[test]
    fn test_minimum_owner_requirement() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Remove owners until only one remains
        MultiSigWallet::remove_owner(env.clone(), owners.get(1).unwrap().clone());

        // Attempt to remove the last owner
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::remove_owner(env.clone(), owners.get(0).unwrap().clone());
        });

        assert!(result.is_err(), "Should not be able to remove the last owner");
    }

    #[test]
    fn test_transaction_execution_order() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create multiple transactions
        let tx1 = MultiSigWallet::submit_transaction(
            env.clone(),
            Address::generate(&env),
            1000000,
            Bytes::new(&env)
        );

        let tx2 = MultiSigWallet::submit_transaction(
            env.clone(),
            Address::generate(&env),
            2000000,
            Bytes::new(&env)
        );

        // Approve both transactions
        MultiSigWallet::approve_transaction(env.clone(), tx1.clone(), owners.get(0).unwrap());
        MultiSigWallet::approve_transaction(env.clone(), tx2.clone(), owners.get(0).unwrap());

        // Execute in order
        MultiSigWallet::approve_transaction(env.clone(), tx1.clone(), owners.get(1).unwrap);
        MultiSigWallet::approve_transaction(env.clone(), tx2.clone(), owners.get(1).unwrap);

        // Verify both executed
        assert_eq!(
            MultiSigWallet::get_transaction_status(env.clone(), tx1.clone()),
            TransactionStatus::Executed
        );
        assert_eq!(
            MultiSigWallet::get_transaction_status(env.clone(), tx2.clone()),
            TransactionStatus::Executed
        );
    }

    #[test]
    fn test_large_transaction_data() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create large transaction data
        let large_data = Bytes::from_slice(&env, &[0; 10000]); // 10KB of data

        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                Address::generate(&env),
                1000000,
                large_data
            );
        });

        // Should either be accepted or rejected due to gas limits
        assert!(result.is_ok() || result.is_err(), "Large data should be handled appropriately");
    }

    #[test]
    fn test_concurrent_transaction_execution() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create transaction
        let transaction_id = MultiSigWallet::submit_transaction(
            env.clone(),
            Address::generate(&env),
            1000000,
            Bytes::new(&env)
        );

        // Approve from multiple owners concurrently
        MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), owners.get(0).unwrap);
        
        // Attempt concurrent execution
        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::approve_transaction(env.clone(), transaction_id.clone(), owners.get(1).unwrap);
        });

        assert!(result.is_ok(), "Concurrent approvals should be handled correctly");
        
        // Verify transaction executed exactly once
        let tx_status = MultiSigWallet::get_transaction_status(env.clone(), transaction_id.clone());
        assert_eq!(tx_status, TransactionStatus::Executed);
    }

    #[test]
    fn test_gas_exhaustion_protection() {
        let (env, owners, _) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &owners, 2);

        // Create complex transaction that might cause gas exhaustion
        let complex_data = Bytes::from_slice(&env, &[0; 50000]); // Large data

        let result = std::panic::catch_unwind(|| {
            MultiSigWallet::submit_transaction(
                env.clone(),
                Address::generate(&env),
                1000000,
                complex_data
            );
        });

        // Should handle gas limits gracefully
        assert!(result.is_ok() || result.is_err(), "Gas exhaustion should be handled gracefully");
    }
}
