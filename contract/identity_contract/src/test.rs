#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env, String, Vec};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    
    client.initialize(&admin);
    
    // Should panic on re-initialization
    let result = client.try_initialize(&admin);
    assert!(result.is_err());
}

#[test]
fn test_create_did() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    
    // User creates DID
    let did = client.create_did(&user, &public_key);
    
    assert!(did.to_string().starts_with("did:stellar:"));
    
    // Should fail if same user tries again
    let result = client.try_create_did(&user, &public_key);
    assert!(result.is_err());
}

#[test]
fn test_add_claim() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    let claim_type = String::from_str(&env, "twitter");
    let claim_value = String::from_str(&env, "@user123");
    let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    
    let claim_id = client.add_claim(&did, &claim_type, &claim_value, &proof);
    assert_eq!(claim_id, 1);
}

#[test]
fn test_verify_claim() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    let claim_type = String::from_str(&env, "github");
    let claim_value = String::from_str(&env, "user123");
    let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    
    let claim_id = client.add_claim(&did, &claim_type, &claim_value, &proof);
    
    // Admin verifies the claim
    let oracle_signature = Bytes::from_slice(&env, &[5, 6, 7, 8]);
    client.verify_claim(&did, &claim_id, &oracle_signature);
    
    // Check that claim is verified
    let is_verified = client.is_claim_verified(&did, &claim_id);
    assert!(is_verified);
}

#[test]
fn test_revoke_claim() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    let claim_type = String::from_str(&env, "email");
    let claim_value = String::from_str(&env, "user@example.com");
    let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    
    let claim_id = client.add_claim(&did, &claim_type, &claim_value, &proof);
    
    // User revokes their own claim
    let reason = String::from_str(&env, "no longer valid");
    client.revoke_claim(&did, &claim_id, &reason);
    
    // Check that claim is revoked
    let is_verified = client.is_claim_verified(&did, &claim_id);
    assert!(!is_verified);
}

#[test]
fn test_delegation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let delegate = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    // User delegates "add_claim" permission to delegate
    let permissions = vec![&env, String::from_str(&env, "add_claim")];
    let expiry = env.ledger().timestamp() + 86400; // 1 day from now
    
    client.add_delegation(&did, &delegate, &permissions, &expiry);
    
    // Delegate can now add claims
    env.as_contract(&contract_id, || {
        env.invoker().set(delegate.clone());
        
        let claim_type = String::from_str(&env, "discord");
        let claim_value = String::from_str(&env, "user123#4567");
        let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
        
        let claim_id = client.add_claim(&did, &claim_type, &claim_value, &proof);
        assert_eq!(claim_id, 1);
    });
    
    // Revoke delegation
    client.revoke_delegation(&did, &delegate);
    
    // Should fail now
    env.as_contract(&contract_id, || {
        env.invoker().set(delegate.clone());
        let claim_type = String::from_str(&env, "telegram");
        let claim_value = String::from_str(&env, "@user123");
        let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
        
        let result = client.try_add_claim(&did, &claim_type, &claim_value, &proof);
        assert!(result.is_err());
    });
}

#[test]
fn test_reputation_scoring() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    // Base reputation score
    let initial_score = client.get_reputation_score(&did);
    assert_eq!(initial_score, 100); // REPUTATION_BASE_SCORE
    
    // Add verified claim increases score
    let claim_type = String::from_str(&env, "github");
    let claim_value = String::from_str(&env, "verified_user");
    let proof = Bytes::from_slice(&env, &[1, 2, 3, 4]);
    let claim_id = client.add_claim(&did, &claim_type, &claim_value, &proof);
    
    let oracle_signature = Bytes::from_slice(&env, &[5, 6, 7, 8]);
    client.verify_claim(&did, &claim_id, &oracle_signature);
    
    let score_after_verification = client.get_reputation_score(&did);
    assert_eq!(score_after_verification, 130); // 100 + 30 (VERIFIED_CREDENTIAL_SCORE)
    
    // Add event attendance
    let event_id = String::from_str(&env, "event_001");
    client.add_event_attendance(&did, &event_id, &50);
    
    let final_score = client.get_reputation_score(&did);
    assert_eq!(final_score, 180); // 130 + 50 (EVENT_ATTENDANCE_SCORE)
}

#[test]
fn test_did_resolution() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    // Resolve DID
    let did_document = client.resolve_did(&did);
    
    assert_eq!(did_document.id, did);
    assert_eq!(did_document.controller, user);
    assert_eq!(did_document.public_key, public_key);
    assert!(!did_document.deactivated);
    assert_eq!(did_document.reputation_score, 100);
    
    // Get DID by address
    let resolved_did = client.get_did_by_address(&user);
    assert!(resolved_did.is_some());
    assert_eq!(resolved_did.unwrap(), did);
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    
    // Pause contract
    client.pause();
    
    // Should fail to create DID when paused
    let result = client.try_create_did(&user, &public_key);
    assert!(result.is_err());
    
    // Unpause contract
    client.unpause();
    
    // Should work now
    let did = client.create_did(&user, &public_key);
    assert!(did.to_string().starts_with("did:stellar:"));
}

#[test]
fn test_deactivate_did() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    // Deactivate DID
    client.deactivate_did(&did);
    
    // Check that DID is deactivated
    let did_document = client.resolve_did(&did);
    assert!(did_document.deactivated);
}

#[test]
fn test_get_verified_claims_by_type() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[0; 32]);
    
    client.initialize(&admin);
    let did = client.create_did(&user, &public_key);
    
    // Add multiple claims
    let github_claim = client.add_claim(
        &did,
        &String::from_str(&env, "github"),
        &String::from_str(&env, "user1"),
        &Bytes::from_slice(&env, &[1]),
    );
    
    let twitter_claim = client.add_claim(
        &did,
        &String::from_str(&env, "twitter"),
        &String::from_str(&env, "@user1"),
        &Bytes::from_slice(&env, &[2]),
    );
    
    let email_claim = client.add_claim(
        &did,
        &String::from_str(&env, "github"), // Another github claim
        &String::from_str(&env, "user2"),
        &Bytes::from_slice(&env, &[3]),
    );
    
    // Verify some claims
    let oracle_signature = Bytes::from_slice(&env, &[4, 5, 6, 7]);
    client.verify_claim(&did, &github_claim, &oracle_signature);
    client.verify_claim(&did, &email_claim, &oracle_signature);
    
    // Get verified github claims
    let verified_github_claims = client.get_verified_claims_by_type(&did, &String::from_str(&env, "github"));
    
    assert_eq!(verified_github_claims.len(), 2);
    
    // Check that both verified github claims are returned
    let mut found_claims = Vec::new(&env);
    for claim in verified_github_claims.iter() {
        found_claims.push_back(claim.claim_value);
    }
    
    assert!(found_claims.contains(&String::from_str(&env, "user1")));
    assert!(found_claims.contains(&String::from_str(&env, "user2")));
}