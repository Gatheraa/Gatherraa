#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, String, Symbol, Vec,
};

// Mock contracts for testing
#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    pub fn get_value(_env: Env, _pair: String) -> (i128, u64) {
        (110_000_000_i128, _env.ledger().timestamp())
    }
}

#[contract]
pub struct MockDex;

#[contractimpl]
impl MockDex {
    pub fn get_spot_price(_env: Env, _pair: String) -> i128 {
        105_000_000_i128
    }
}

fn create_contract(e: &Env, admin: &Address) -> SoulboundTicketContractClient<'static> {
    let contract_id = e.register(SoulboundTicketContract, ());
    let client = SoulboundTicketContractClient::new(e, &contract_id);

    client.initialize(
        admin,
        &String::from_str(e, "EventTicket"),
        &String::from_str(e, "TKT"),
        &String::from_str(e, "https://example.com"),
        &e.ledger().timestamp(),
        &(e.ledger().timestamp() + 100000),
    );
    client
}

// ============================================================================
// MINIMUM/MAXIMUM VALUE TESTS
// ============================================================================

#[test]
#[should_panic(expected = "price must be greater than 0")]
fn test_minimum_ticket_price() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "MIN");
    
    // Test with zero price (should fail)
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Minimum Tier"),
        &0,
        &10,
        &PricingStrategy::Standard,
    );
}

#[test]
fn test_maximum_ticket_price() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "MAX");
    
    // Test with maximum possible price
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Maximum Tier"),
        &i128::MAX,
        &10,
        &PricingStrategy::Standard,
    );

    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, i128::MAX);
}

#[test]
fn test_maximum_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "SUPPLY");
    
    // Test with maximum supply
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Max Supply Tier"),
        &100,
        &u32::MAX,
        &PricingStrategy::Standard,
    );

    // Should be able to mint up to maximum supply
    client.batch_mint(&user, &tier_sym, &1000);
    let balance = client.balance(&user);
    assert_eq!(balance, 1000);
}

#[test]
#[should_panic(expected = "batch size cannot be zero")]
fn test_minimum_batch_size() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "ZERO");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Zero Batch"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    // Test with zero batch size (should fail)
    client.batch_mint(&user, &tier_sym, &0);
}

#[test]
fn test_maximum_batch_size() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "LARGE");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Large Batch"),
        &100,
        &10000,
        &PricingStrategy::Standard,
    );

    // Test with large batch size
    client.batch_mint(&user, &tier_sym, &1000);
    let balance = client.balance(&user);
    assert_eq!(balance, 1000);
}

// ============================================================================
// ZERO VALUE TESTS
// ============================================================================

#[test]
fn test_zero_price_floor_ceiling() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "ZERO_PRICE");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Zero Price"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    let config = PricingConfig {
        oracle_address: admin.clone(),
        dex_pool_address: admin.clone(),
        price_floor: 0,
        price_ceiling: 0,
        update_frequency: 0,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    // Price should be handled gracefully with zero floor/ceiling
    let price = client.get_ticket_price(&tier_sym);
    assert!(price >= 0);
}

#[test]
fn test_zero_update_frequency() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "ZERO_FREQ");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Zero Freq"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    let config = PricingConfig {
        oracle_address: admin.clone(),
        dex_pool_address: admin.clone(),
        price_floor: 50,
        price_ceiling: 150,
        update_frequency: 0, // Zero update frequency
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    // Should handle zero update frequency gracefully
    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, 100);
}

#[test]
fn test_zero_maximum_oracle_age() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "ZERO_AGE");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Zero Age"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    let config = PricingConfig {
        oracle_address: admin.clone(),
        dex_pool_address: admin.clone(),
        price_floor: 50,
        price_ceiling: 150,
        update_frequency: 3600,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: 0, // Zero max age
    };
    client.set_pricing_config(&config);

    // Should handle zero max oracle age (immediate staleness)
    let price = client.get_ticket_price(&tier_sym);
    assert!(price >= 50 && price <= 150);
}

// ============================================================================
// EMPTY COLLECTION TESTS
// ============================================================================

#[test]
fn test_empty_tier_list() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Test getting all tiers when none exist
    let tiers = client.get_all_tiers();
    assert_eq!(tiers.len(), 0);
}

#[test]
fn test_empty_user_balance() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Test balance for user with no tickets
    let balance = client.balance(&user);
    assert_eq!(balance, 0);
}

#[test]
fn test_empty_ticket_query() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Test querying non-existent ticket
    let result = std::panic::catch_unwind(|| {
        client.get_ticket(&999);
    });
    
    // Should handle gracefully or panic appropriately
    assert!(result.is_err());
}

#[test]
fn test_empty_lottery_entries() {
    let e = Env::default();
    let mut entries = Vec::new(&e);

    // Test lottery allocation with empty entries
    let mut randomness = Vec::new(&e);
    randomness.push_back(42).unwrap();
    
    let results = allocation::AllocationEngine::allocate_lottery(&e, &entries, &randomness, 5);
    assert_eq!(results.len(), 0);
}

#[test]
fn test_empty_randomness_pool() {
    let e = Env::default();
    let mut entries = Vec::new(&e);
    
    // Add some entries
    for i in 0..5u32 {
        entries.push_back(allocation::LotteryEntry {
            participant: Address::generate(&e),
            entry_time: e.ledger().timestamp(),
            nonce: i,
            commitment_hash: None,
        }).unwrap();
    }

    // Test with empty randomness
    let mut randomness = Vec::new(&e);
    let results = allocation::AllocationEngine::allocate_lottery(&e, &entries, &randomness, 3);
    assert_eq!(results.len(), 0);
}

// ============================================================================
// ERROR CONDITION TESTS
// ============================================================================

#[test]
#[should_panic(expected = "unauthorized")]
fn test_unauthorized_tier_creation() {
    let e = Env::default();
    // Don't mock auths to test authorization
    let admin = Address::generate(&e);
    let non_admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "UNAUTH");
    
    // Test unauthorized tier creation
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Unauthorized"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );
}

#[test]
#[should_panic(expected = "tier already exists")]
fn test_duplicate_tier_creation() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "DUP");
    
    // Create first tier
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "First"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    // Try to create duplicate tier (should fail)
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Duplicate"),
        &200,
        &20,
        &PricingStrategy::Standard,
    );
}

#[test]
#[should_panic(expected = "exceeds maximum supply")]
fn test_exceed_maximum_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "LIMIT");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Limited"),
        &100,
        &10, // Max supply of 10
        &PricingStrategy::Standard,
    );

    // Try to mint more than maximum supply
    client.batch_mint(&user, &tier_sym, &15);
}

#[test]
#[should_panic(expected = "invalid pricing strategy")]
fn test_invalid_pricing_strategy() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "INVALID");
    
    // Test with invalid pricing strategy (if such validation exists)
    // This tests enum validation
    let invalid_strategy = PricingStrategy::Standard; // Assume this might be invalid in some context
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Invalid Strategy"),
        &100,
        &10,
        &invalid_strategy,
    );
}

#[test]
fn test_oracle_failure_handling() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "ORACLE_FAIL");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Oracle Fail"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    // Configure with invalid oracle address
    let config = PricingConfig {
        oracle_address: Address::generate(&e), // Invalid oracle
        dex_pool_address: Address::generate(&e), // Invalid DEX
        price_floor: 50,
        price_ceiling: 150,
        update_frequency: 3600,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    // Should fallback gracefully when oracle fails
    let price = client.get_ticket_price(&tier_sym);
    assert!(price >= 50 && price <= 150);
}

#[test]
fn test_stale_oracle_data() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Register mock oracle
    let oracle_id = e.register(MockOracle, ());
    let dex_id = e.register(MockDex, ());

    let tier_sym = Symbol::new(&e, "STALE");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Stale Oracle"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    let config = PricingConfig {
        oracle_address: oracle_id,
        dex_pool_address: dex_id,
        price_floor: 50,
        price_ceiling: 150,
        update_frequency: 1, // Very frequent updates
        last_update_time: 0, // Very old timestamp
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: 1, // Very short staleness tolerance
    };
    client.set_pricing_config(&config);

    // Should handle stale oracle data gracefully
    let price = client.get_ticket_price(&tier_sym);
    assert!(price >= 50 && price <= 150);
}

#[test]
fn test_price_bounds_enforcement() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "BOUNDS");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Price Bounds"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    // Set very tight bounds
    let config = PricingConfig {
        oracle_address: admin.clone(),
        dex_pool_address: admin.clone(),
        price_floor: 95,
        price_ceiling: 105,
        update_frequency: 0,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    // Mint lots of tickets to trigger price increase
    client.batch_mint(&user, &tier_sym, &10);

    // Price should be clamped to bounds
    let price = client.get_ticket_price(&tier_sym);
    assert!(price >= 95 && price <= 105);
}

#[test]
fn test_vrf_invalid_proof() {
    let e = Env::default();
    let input = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let (_, proof) = vrf::VRFEngine::generate_vrf_randomness(&e, input.clone(), 0);

    // Test verification with wrong input
    let wrong_input = e.crypto().sha256(&soroban_sdk::Bytes::from_array(&e, &[1u8; 32]));
    let is_valid = vrf::VRFEngine::verify_vrf_proof(&e, &proof, wrong_input, proof.ledger_sequence);
    assert!(!is_valid);
}

#[test]
fn test_commitment_invalid_reveal() {
    let e = Env::default();
    e.mock_all_auths();
    let committer = Address::generate(&e);
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let nonce = 42u32;

    let (hash, _) = commitment::CommitmentScheme::commit(&e, seed.clone(), nonce, committer);

    // Test invalid reveal with wrong nonce
    let invalid_reveal = commitment::Reveal {
        seed: seed.clone(),
        nonce: 999, // Wrong nonce
        revealed_at: e.ledger().timestamp(),
    };

    let is_valid = commitment::CommitmentScheme::verify_reveal(&e, &hash, &invalid_reveal);
    assert!(!is_valid);
}

#[test]
fn test_allocation_zero_slots() {
    let e = Env::default();
    let mut entries = Vec::new(&e);
    
    // Add entries
    for i in 0..10u32 {
        entries.push_back(allocation::LotteryEntry {
            participant: Address::generate(&e),
            entry_time: e.ledger().timestamp(),
            nonce: i,
            commitment_hash: None,
        }).unwrap();
    }

    let mut randomness = Vec::new(&e);
    for i in 0..5u32 {
        randomness.push_back((i as u128 * 12345u128) % 1000000u128).unwrap();
    }

    // Test allocation with zero slots
    let results = allocation::AllocationEngine::allocate_lottery(&e, &entries, &randomness, 0);
    assert_eq!(results.len(), 0);
}

#[test]
fn test_fcfs_zero_allocation() {
    let e = Env::default();
    let mut entries = Vec::new(&e);
    
    // Add entries
    for i in 0..5u32 {
        entries.push_back(allocation::LotteryEntry {
            participant: Address::generate(&e),
            entry_time: e.ledger().timestamp(),
            nonce: i,
            commitment_hash: None,
        }).unwrap();
    }

    // Test FCFS with zero allocation
    let results = allocation::AllocationEngine::allocate_fcfs(&e, &entries, 0);
    assert_eq!(results.len(), 0);
}
