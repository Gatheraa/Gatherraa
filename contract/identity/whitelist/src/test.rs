#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, BytesN, Env, Vec, Bytes};
use crate::merkle;

// Helper to create a simple Merkle tree for testing
// Leaf 0: (Address1, 100)
// Leaf 1: (Address2, 200)
// Root = hash(hash(L0), hash(L1))
fn create_test_merkle(env: &Env, addr1: &Address, addr2: &Address) -> (BytesN<32>, Vec<BytesN<32>>, Vec<BytesN<32>>) {
    let l0 = WhitelistContract::hash_leaf(env, addr1, 100);
    let l1 = WhitelistContract::hash_leaf(env, addr2, 200);
    
    let mut data = [0u8; 64];
    if l0 < l1 {
        data[..32].copy_from_slice(&l0.to_array());
        data[32..].copy_from_slice(&l1.to_array());
    } else {
        data[..32].copy_from_slice(&l1.to_array());
        data[32..].copy_from_slice(&l0.to_array());
    }
    let root = env.crypto().sha256(&data.into());
    
    let mut proof0 = Vec::new(env);
    proof0.push_back(l1.clone());
    
    let mut proof1 = Vec::new(env);
    proof1.push_back(l0.clone());
    
    (root, proof0, proof1)
}

#[test]
fn test_whitelist_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, WhitelistContract);
    let client = WhitelistContractClient::new(&env, &contract_id);
    
    client.init(&admin);

    // Create a mock token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    let token_client_token = token::Client::new(&env, &token_id);
    
    token_client.mint(&admin, &1000);

    let (root, proof1, proof2) = create_test_merkle(&env, &user1, &user2);
    
    let campaign_id = client.create_campaign(&admin, &token_id, &root, &10000, &300);

    // User 1 claims
    client.claim(&campaign_id, &user1, &100, &proof1, &None);
    assert_eq!(token_client_token.balance(&user1), 100);
    
    // User 2 claims to another address
    let recipient = Address::generate(&env);
    client.claim(&campaign_id, &user2, &200, &proof2, &Some(recipient.clone()));
    assert_eq!(token_client_token.balance(&recipient), 200);
    
    // Check campaign state
    let campaign = client.get_campaign(&campaign_id);
    assert_eq!(campaign.claimed_amount, 300);
}

#[test]
fn test_delegation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let delegator = Address::generate(&env);
    let delegatee = Address::generate(&env);
    let other = Address::generate(&env);
    
    let contract_id = env.register_contract(None, WhitelistContract);
    let client = WhitelistContractClient::new(&env, &contract_id);
    client.init(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    token_client.mint(&admin, &1000);

    let (root, proof1, _) = create_test_merkle(&env, &delegator, &other);
    let campaign_id = client.create_campaign(&admin, &token_id, &root, &10000, &300);

    // Delegate
    client.delegate_claim(&campaign_id, &delegator, &delegatee);
    
    // Claim as delegate
    client.claim_as_delegate(&campaign_id, &delegator, &delegatee, &100, &proof1, &None);
    
    let token_client_token = token::Client::new(&env, &token_id);
    assert_eq!(token_client_token.balance(&delegator), 100);
}

#[test]
#[should_panic(expected = "already claimed")]
fn test_double_claim_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, WhitelistContract);
    let client = WhitelistContractClient::new(&env, &contract_id);
    client.init(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    token_client.mint(&admin, &1000);

    let (root, proof1, _) = create_test_merkle(&env, &user1, &user1);
    let campaign_id = client.create_campaign(&admin, &token_id, &root, &10000, &300);

    client.claim(&campaign_id, &user1, &100, &proof1, &None);
    client.claim(&campaign_id, &user1, &100, &proof1, &None); // Should panic
}

#[test]
fn test_refund() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    
    let contract_id = env.register_contract(None, WhitelistContract);
    let client = WhitelistContractClient::new(&env, &contract_id);
    client.init(&admin);

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::StellarAssetClient::new(&env, &token_id);
    token_client.mint(&admin, &1000);

    let (root, proof1, _) = create_test_merkle(&env, &user1, &user1);
    let campaign_id = client.create_campaign(&admin, &token_id, &root, &10, &300);

    // Advance time past deadline (10s)
    env.ledger().set_timestamp(20);
    
    client.refund(&campaign_id);
    
    let token_client_token = token::Client::new(&env, &token_id);
    assert_eq!(token_client_token.balance(&admin), 1000); // Refunded full 300
}
