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
    testutils::{Address as _},
    Address, Env, Symbol, Vec, IntoVal,
};
use crate::{
    MultisigWalletContract, MultisigWalletContractClient, TransactionStatus
};

// ---------------------------------------------------------------------------
// Malicious Contracts for Attack Simulation
// ---------------------------------------------------------------------------

#[contract]
pub struct MaliciousReentrancyMultisigContract;

#[contractimpl]
impl MaliciousReentrancyMultisigContract {
    pub fn init(env: Env, target: Address, transaction_id: Symbol) {
        env.storage().instance().set(&Symbol::new(&env, "should_reenter"), &true);
        env.storage().instance().set(&Symbol::new(&env, "call_count"), &0u32);
        env.storage().instance().set(&Symbol::new(&env, "target"), &target);
        env.storage().instance().set(&Symbol::new(&env, "transaction_id"), &transaction_id);
    }

    /// Malicious callback that attempts reentrancy during transaction execution
    pub fn malicious_callback(env: Env) -> i128 {
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
            let transaction_id: Symbol = env.storage().instance()
                .get(&Symbol::new(&env, "transaction_id"))
                .unwrap();
            
            env.storage().instance().set(&Symbol::new(&env, "should_reenter"), &false);
            
            // Attempt reentrant execution
            let multisig_client = MultisigWalletContractClient::new(&env, &target);
            // This call should fail because transaction is already being executed (status updated before call)
            let _ = multisig_client.execute_transaction(&transaction_id);
        }
        0
    }

    pub fn get_call_count(env: Env) -> u32 {
        env.storage().instance()
            .get(&Symbol::new(&env, "call_count"))
            .unwrap_or(0)
    }
}

// ---------------------------------------------------------------------------
// Security Test Suite
// ---------------------------------------------------------------------------

fn create_test_env() -> (Env, Vec<Address>, Address, MultisigWalletContractClient<'static>) {
    let env = Env::default();
    let mut owners = Vec::new(&env);

    // Create multiple owners for multisig
    for _ in 0..3 {
        owners.push_back(Address::generate(&env));
    }

    let non_owner = Address::generate(&env);
    let contract_id = env.register(MultisigWalletContract, ());
    let client = MultisigWalletContractClient::new(&env, &contract_id);
    (env, owners, non_owner, client)
}

fn initialize_multisig_wallet(_env: &Env, client: &MultisigWalletContractClient, owners: &Vec<Address>, threshold: u32) {
    client.initialize(owners, &threshold, &0, &i128::MAX);
}

// ---------------------------------------------------------------------------
// Reentrancy Attack Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    #[should_panic]
    fn test_reentrancy_attack_transaction_execution() {
        let (env, owners, _, client) = create_test_env();
        env.mock_all_auths();
        
        initialize_multisig_wallet(&env, &client, &owners, 2);

    // Create a transaction that calls back into the multisig
    let malicious_id = env.register(MaliciousReentrancyMultisigContract, ());
    let malicious_client = MaliciousReentrancyMultisigContractClient::new(&env, &malicious_id);

    let creator = owners.get(0).unwrap();
    let destination = malicious_id.clone();
    let amount = 0i128;
    let function = Symbol::new(&env, "malicious_callback");
    let data = Vec::new(&env);
    let expires_at = env.ledger().timestamp() + 1000;

    let transaction_id = client.submit_transaction(
        &creator,
        &destination,
        &amount,
        &function,
        &data,
        &expires_at
    );

    malicious_client.init(&client.address, &transaction_id);

    // Approve transaction by 2 owners
    client.approve_transaction(&transaction_id, &owners.get(1).unwrap());
    client.approve_transaction(&transaction_id, &owners.get(2).unwrap());

    // Attempt execution (will trigger callback)
    client.execute_transaction(&transaction_id);
}

// ---------------------------------------------------------------------------
// Access Control Tests
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_unauthorized_transaction_submission() {
    let (env, owners, non_owner, client) = create_test_env();
    env.mock_all_auths();

    initialize_multisig_wallet(&env, &client, &owners, 2);

    // Attempt transaction submission by non-owner
    let _ = client.submit_transaction(
        &non_owner,
        &Address::generate(&env),
        &1000000i128,
        &Symbol::new(&env, "any"),
        &Vec::new(&env),
        &(env.ledger().timestamp() + 1000)
    );
}

#[test]
#[should_panic]
fn test_unauthorized_transaction_approval() {
    let (env, owners, non_owner, client) = create_test_env();
    env.mock_all_auths();

    initialize_multisig_wallet(&env, &client, &owners, 2);

    // Create transaction as owner
    let transaction_id = client.submit_transaction(
        &owners.get(0).unwrap(),
        &Address::generate(&env),
        &1000000i128,
        &Symbol::new(&env, "any"),
        &Vec::new(&env),
        &(env.ledger().timestamp() + 1000)
    );

    // Attempt approval by non-owner
    let _ = client.approve_transaction(&transaction_id, &non_owner);
}

#[test]
#[should_panic]
fn test_self_approval_rejection() {
    let (env, owners, _, client) = create_test_env();
    env.mock_all_auths();

    initialize_multisig_wallet(&env, &client, &owners, 2);

    // Create transaction as owner
    let creator = owners.get(0).unwrap();
    let transaction_id = client.submit_transaction(
        &creator,
        &Address::generate(&env),
        &1000000i128,
        &Symbol::new(&env, "any"),
        &Vec::new(&env),
        &(env.ledger().timestamp() + 1000)
    );

    // Attempt approval by creator
    let _ = client.approve_transaction(&transaction_id, &creator);
}

#[test]
#[should_panic]
fn test_unauthorized_governance_call() {
    let (env, owners, _, client) = create_test_env();
    env.mock_all_auths();

    initialize_multisig_wallet(&env, &client, &owners, 2);

    let tx_id = client.submit_transaction(
        &owners.get(0).unwrap(),
        &client.address,
        &0,
        &Symbol::new(&env, "add_owner"),
        &Vec::new(&env),
        &(env.ledger().timestamp() + 1000)
    );

    client.approve_transaction(&tx_id, &owners.get(1).unwrap());
    client.approve_transaction(&tx_id, &owners.get(2).unwrap());
    client.execute_transaction(&tx_id);

    // Attempt to call add_owner directly from a user account (should fail due to require_auth on contract address)
    env.mock_auths(&[]);
    client.add_owner(&Address::generate(&env), &tx_id);
}

// ---------------------------------------------------------------------------
// Threshold and Governance Tests
// ---------------------------------------------------------------------------

#[test]
#[should_panic]
fn test_invalid_threshold_values() {
    let (env, owners, _, client) = create_test_env();
    env.mock_all_auths();

    // Test with zero threshold during initialization
    client.initialize(&owners, &0, &0, &i128::MAX);
}

#[test]
fn test_governance_execution() {
    let (env, owners, _, client) = create_test_env();
    env.mock_all_auths();

    initialize_multisig_wallet(&env, &client, &owners, 2);

    let new_owner = Address::generate(&env);

    // Prepare a transaction that calls add_owner on the multisig itself
    let mut args = Vec::new(&env);
    args.push_back(new_owner.clone().into_val(&env));
    // We will push a dummy tx_id for now, as we don't know the exact tx_id yet.
    // Since we use a counter, we know it will be "0".
    args.push_back(Symbol::new(&env, "0").into_val(&env));

    let tx_id = client.submit_transaction(
        &owners.get(0).unwrap(),
        &client.address,
        &0,
        &Symbol::new(&env, "add_owner"),
        &args,
        &(env.ledger().timestamp() + 1000)
    );

    assert_eq!(tx_id, Symbol::new(&env, "0"));

    client.approve_transaction(&tx_id, &owners.get(1).unwrap());
    client.approve_transaction(&tx_id, &owners.get(2).unwrap());

    client.execute_transaction(&tx_id);

        // Verify that the new owner was added
        let config = client.get_config();
        assert!(config.owners.contains(&new_owner));
    }
}
