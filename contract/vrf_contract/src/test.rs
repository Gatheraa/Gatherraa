use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{VRFContract, VRFStatus, VRFProof, ProviderType, SourceType, TestResult};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    let version = VRFContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_register_provider() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let provider = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[1; 32]);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    VRFContract::register_provider(
        env.clone(),
        provider.clone(),
        ProviderType::Stellar,
        public_key.clone(),
        1000, // fee
    );
    
    let provider_info = VRFContract::get_provider(env.clone(), provider.clone());
    assert_eq!(provider_info.address, provider);
    assert_eq!(provider_info.provider_type, ProviderType::Stellar);
    assert_eq!(provider_info.public_key, public_key);
    assert_eq!(provider_info.reputation_score, 100);
    assert!(provider_info.active);
}

#[test]
fn test_request_vrf() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let requester = Address::generate(&env);
    let seed = BytesN::from_array(&env, &[2; 32]);
    let additional_data = vec![&env, 1, 2, 3, 4];
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    let request_id = VRFContract::request_vrf(
        env.clone(),
        requester.clone(),
        seed.clone(),
        additional_data.clone(),
        3, // max_providers
    );
    
    let request = VRFContract::get_vrf_request(env.clone(), request_id.clone());
    assert_eq!(request.requester, requester);
    assert_eq!(request.seed, seed);
    assert_eq!(request.status, VRFStatus::Pending);
    assert_eq!(request.additional_data, additional_data);
}

#[test]
fn test_fulfill_vrf() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let requester = Address::generate(&env);
    let provider = Address::generate(&env);
    let seed = BytesN::from_array(&env, &[2; 32]);
    let additional_data = vec![&env, 1, 2, 3, 4];
    let randomness_output = BytesN::from_array(&env, &[3; 32]);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    // Register provider
    let public_key = BytesN::from_array(&env, &[1; 32]);
    VRFContract::register_provider(
        env.clone(),
        provider.clone(),
        ProviderType::Stellar,
        public_key.clone(),
        1000,
    );
    
    let request_id = VRFContract::request_vrf(
        env.clone(),
        requester.clone(),
        seed.clone(),
        additional_data.clone(),
        1,
    );
    
    // Create VRF proof
    let proof = VRFProof {
        proof_bytes: vec![&env, 1; 100],
        public_key: public_key.clone(),
        gamma: BytesN::from_array(&env, &[4; 32]),
        c: BytesN::from_array(&env, &[5; 32]),
        s: BytesN::from_array(&env, &[6; 32]),
        verification_hash: BytesN::from_array(&env, &[7; 32]),
        provider: provider.clone(),
        created_at: env.ledger().timestamp(),
    };
    
    // Fulfill request
    let result = VRFContract::fulfill_vrf(
        env.clone(),
        request_id.clone(),
        proof.clone(),
        randomness_output.clone(),
    );
    
    assert!(result);
    
    let request = VRFContract::get_vrf_request(env.clone(), request_id.clone());
    assert_eq!(request.status, VRFStatus::Fulfilled);
    assert!(request.fulfilled_at.is_some());
    assert_eq!(request.randomness_output, Some(randomness_output));
}

#[test]
fn test_generate_randomness() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let additional_entropy = vec![&env, 5, 6, 7, 8];
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    let randomness1 = VRFContract::generate_randomness(env.clone(), additional_entropy.clone());
    let randomness2 = VRFContract::generate_randomness(env.clone(), additional_entropy.clone());
    
    // Should be different due to timestamp
    assert_ne!(randomness1, randomness2);
    
    // Should be valid (not all zeros)
    assert_ne!(randomness1, BytesN::from_array(&env, &[0; 32]));
    assert_ne!(randomness2, BytesN::from_array(&env, &[0; 32]));
}

#[test]
fn test_validate_randomness_quality() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    // Test with good randomness
    let good_randomness = BytesN::from_array(&env, &[
        0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
        0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88,
        0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00,
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    ]);
    
    let is_valid = VRFContract::validate_randomness_quality(env.clone(), &good_randomness);
    assert!(is_valid);
    
    // Test with bad randomness (all zeros)
    let bad_randomness = BytesN::from_array(&env, &[0; 32]);
    let is_valid = VRFContract::validate_randomness_quality(env.clone(), &bad_randomness);
    assert!(!is_valid);
}

#[test]
fn test_provider_reputation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let provider = Address::generate(&env);
    let public_key = BytesN::from_array(&env, &[1; 32]);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    VRFContract::register_provider(
        env.clone(),
        provider.clone(),
        ProviderType::Stellar,
        public_key.clone(),
        1000,
    );
    
    // Initial reputation should be 100
    let reputation = VRFContract::get_provider_reputation(env.clone(), provider.clone());
    assert_eq!(reputation, 100);
    
    // Update reputation with success
    VRFContract::update_provider_reputation(env.clone(), provider.clone(), true);
    let reputation = VRFContract::get_provider_reputation(env.clone(), provider.clone());
    assert_eq!(reputation, 100); // Should stay at max
    
    // Update reputation with failure
    VRFContract::update_provider_reputation(env.clone(), provider.clone(), false);
    let reputation = VRFContract::get_provider_reputation(env.clone(), provider.clone());
    assert_eq!(reputation, 90); // Should decrease by 10
}

#[test]
fn test_quality_metrics() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    let metrics = VRFContract::get_quality_metrics(env.clone());
    assert_eq!(metrics.total_requests, 0);
    assert_eq!(metrics.successful_requests, 0);
    assert_eq!(metrics.randomness_quality_score, 0.0);
}

#[test]
fn test_entropy_sources() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    // Generate randomness to test entropy collection
    let additional_entropy = vec![&env, 1, 2, 3];
    let randomness = VRFContract::generate_randomness(env.clone(), additional_entropy.clone());
    
    // Should be non-zero (indicating entropy was collected)
    assert_ne!(randomness, BytesN::from_array(&env, &[0; 32]));
}

#[test]
fn test_monobit_test() {
    let env = Env::default();
    
    // Test with balanced randomness
    let balanced_randomness = BytesN::from_array(&env, &[
        0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, // Alternating pattern
        0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55,
        0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55,
        0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55,
    ]);
    
    let result = VRFContract::validate_randomness_quality(env.clone(), &balanced_randomness);
    assert!(result);
}

#[test]
fn test_runs_test() {
    let env = Env::default();
    
    // Test with pattern that should fail runs test
    let patterned_randomness = BytesN::from_array(&env, &[
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, // All ones
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // All zeros
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    
    let result = VRFContract::validate_randomness_quality(env.clone(), &patterned_randomness);
    assert!(!result); // Should fail quality tests
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    
    VRFContract::initialize(env.clone(), admin.clone());
    
    // Pause contract
    VRFContract::pause(env.clone());
    
    // Unpause contract
    VRFContract::unpause(env.clone());
}
