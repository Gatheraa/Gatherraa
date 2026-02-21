#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env, String, Symbol};

// ---------------------------------------------------------------------------
// Mock Oracle Contract
//
// Mimics the DIA oracle interface: get_value(pair) -> (i128, u64).
// Returns a configurable price and the ledger's current timestamp so it is
// always considered "fresh".
// ---------------------------------------------------------------------------
#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    /// Returns (110_000_000, now) → price = $1.10 with 8 decimal places
    pub fn get_value(_env: Env, _pair: String) -> (i128, u64) {
        // 110_000_000 means $1.10 in DIA 8-decimal format
        (110_000_000_i128, _env.ledger().timestamp())
    }
}

// ---------------------------------------------------------------------------
// Mock DEX Price Router Contract
//
// Fallback when oracle is unavailable.  Returns a flat spot price.
// ---------------------------------------------------------------------------
#[contract]
pub struct MockDex;

#[contractimpl]
impl MockDex {
    /// Returns 105_000_000 — $1.05 in 8-decimal format
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
        &(e.ledger().timestamp() + 100000), // Refund cutoff
    );
    client
}

#[test]
fn test_initialize_and_tier_creation() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "VIP");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "VIP Ticket"),
        &100,
        &50,
        &PricingStrategy::Standard,
    );

    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, 100);
}

#[test]
fn test_batch_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "General"),
        &50,
        &100,
        &PricingStrategy::Standard,
    );

    client.batch_mint(&user, &tier_sym, &5);

    let balance = client.balance(&user);
    assert_eq!(balance, 5);

    let ticket = client.get_ticket(&1);
    assert_eq!(ticket.tier_symbol, tier_sym);
}

#[test]
#[should_panic(expected = "Soulbound: Tickets cannot be transferred")]
fn test_soulbound_restriction() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "VIP");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "VIP"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );
    client.batch_mint(&user1, &tier_sym, &1);

    // This should panic
    client.transfer(&user1, &user2, &1);
}

#[test]
fn test_dynamic_pricing() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "General"),
        &100,
        &10,
        &PricingStrategy::Standard,
    ); // thresholds every 2 tickets

    // Initial price should be base
    assert_eq!(client.get_ticket_price(&tier_sym), 100);

    // Mint 2 tickets (hits 20% threshold, max_supply=10, 10/5=2)
    client.batch_mint(&user, &tier_sym, &2);

    // Price should increase by 5%
    assert_eq!(client.get_ticket_price(&tier_sym), 105);

    // Mint 2 more (hits 40%)
    client.batch_mint(&user, &tier_sym, &2);

    // Price should increase by 10%
    assert_eq!(client.get_ticket_price(&tier_sym), 110);
}

#[test]
fn test_pricing_strategy_ab_tests() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_a = Symbol::new(&e, "TIERA");
    let tier_b = Symbol::new(&e, "TIERB");

    client.add_tier(
        &tier_a,
        &String::from_str(&e, "A"),
        &100,
        &10,
        &PricingStrategy::AbTestA,
    );
    client.add_tier(
        &tier_b,
        &String::from_str(&e, "B"),
        &100,
        &10,
        &PricingStrategy::AbTestB,
    );

    // Initial prices
    assert_eq!(client.get_ticket_price(&tier_a), 100); // Test A has standard base
    assert_eq!(client.get_ticket_price(&tier_b), 120); // Test B has 20% higher base

    // Increase demand for A
    let user = Address::generate(&e);
    client.batch_mint(&user, &tier_a, &2); // Threshold 1 -> max(1) / 5 = 2. 2 tickets = 1 threshold.
                                           // AbTestA should increase by 10% instead of 5%. 100 -> 110.
    assert_eq!(client.get_ticket_price(&tier_a), 110);
}

#[test]
fn test_emergency_freeze_and_bounds() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);
    let tier_sym = Symbol::new(&e, "T1");

    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "T1"),
        &100,
        &10,
        &PricingStrategy::Standard,
    );

    let config = PricingConfig {
        oracle_address: admin.clone(), // admin == neutral (no oracle configured), returns ORACLE_PRECISION
        dex_pool_address: admin.clone(),
        price_floor: 50,
        price_ceiling: 150,
        update_frequency: 0,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    // Price is 100
    assert_eq!(client.get_ticket_price(&tier_sym), 100);

    // Freeze it
    client.emergency_freeze(&true);
    let user = Address::generate(&e);
    client.batch_mint(&user, &tier_sym, &5); // 5 tickets = 2 thresholds

    // Price would normally update but it shouldn't because frozen. Wait, during batch_mint we update the `tier.current_price`
    // to whatever `get_ticket_price` returns then. Wait, `batch_mint` is free according to the code, it sets price_paid to 0
    // but the `tier.current_price` wouldn't change for the mint unless we re-fetch the price. In batch_mint we weren't updating
    // current_price, but let's check `lib.rs` where we added tier.current_price update. Actually `batch_mint` doesn't call
    // `get_ticket_price()`. In `batch_mint`, `current_price` is not explicitly pulled.
    // So the stored `current_price` remains 100. Let's see if `get_ticket_price` stays 100.
    assert_eq!(client.get_ticket_price(&tier_sym), 100);

    // Unfreeze it
    client.emergency_freeze(&false);
    // 5 mints = 2 thresholds passed. Increase is 2 * 5% = 10%. Price should be 110.
    assert_eq!(client.get_ticket_price(&tier_sym), 110);

    // Force price bounds using AbTestA
    let tier_bounds = Symbol::new(&e, "TBOUNDS");
    client.add_tier(
        &tier_bounds,
        &String::from_str(&e, "TBOUNDS"),
        &140,
        &10,
        &PricingStrategy::AbTestA,
    );
    // 140 base price. A single threshold (2 tickets) increases it by 10% (14). Price -> 154.
    client.batch_mint(&user, &tier_bounds, &2);
    // Since ceiling is 150, price should be clamped.
    assert_eq!(client.get_ticket_price(&tier_bounds), 150);
}

/// Tests that the real oracle code path correctly fetches a price from the
/// mock DIA oracle, converts it to a multiplier, and adjusts ticket prices.
///
/// MockOracle.get_value returns (110_000_000, now) → $1.10
/// Reference price = 100_000_000 (DIA_ORACLE_DECIMALS) → $1.00 baseline
/// Expected multiplier = 110_000_000 * 10_000 / 100_000_000 = 11_000
/// Base tier price = 100
/// After oracle adjustment: 100 * 11_000 / 10_000 = 110
#[test]
fn test_oracle_multiplier_integration() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Register the mock oracle and DEX contracts inside the test environment
    let oracle_id = e.register(MockOracle, ());
    let dex_id = e.register(MockDex, ());

    // Point the PricingConfig at the mock oracle
    let config = PricingConfig {
        oracle_address: oracle_id.clone(),
        dex_pool_address: dex_id.clone(),
        price_floor: 0,
        price_ceiling: i128::MAX,
        update_frequency: 0,
        last_update_time: e.ledger().timestamp(),
        is_frozen: false,
        oracle_pair: String::from_str(&e, "XLM/USD"),
        // $1.00 baseline in 8-decimal format
        oracle_reference_price: oracle::DIA_ORACLE_DECIMALS,
        max_oracle_age_seconds: oracle::DEFAULT_STALENESS_SECONDS,
    };
    client.set_pricing_config(&config);

    let tier_sym = Symbol::new(&e, "ORK");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Oracle Tier"),
        &100,
        &100,
        &PricingStrategy::Standard, // No demand increase yet (0 minted)
    );

    // MockOracle returns $1.10 against a $1.00 reference → 10% markup
    // Expected price: 100 * 11_000 / 10_000 = 110
    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(
        price, 110,
        "oracle multiplier should increase base price by 10%"
    );
}

/// Tests that when the primary oracle is the admin address (unconfigured),
/// prices are unaffected (multiplier == ORACLE_PRECISION == 1x).
#[test]
fn test_oracle_fallback_neutral_when_unconfigured() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    // Default config uses admin as oracle — both calls fail gracefully → neutral
    let tier_sym = Symbol::new(&e, "FLLBK");
    client.add_tier(
        &tier_sym,
        &String::from_str(&e, "Fallback Tier"),
        &200,
        &100,
        &PricingStrategy::Standard,
    );

    // No oracle configured → price should equal base price
    assert_eq!(client.get_ticket_price(&tier_sym), 200);
}
// ============================================================================
// VRF & LOTTERY TESTS
// ============================================================================

#[test]
fn test_vrf_randomness_generation() {
    let e = Env::default();
    let input = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));

    let (output, proof) = vrf::VRFEngine::generate_vrf_randomness(&e, input.clone(), 0);

    // Verify output is 32 bytes
    assert_eq!(output.len(), 32);

    // Verify proof contains valid data
    assert!(!proof.proof.is_empty());
    assert_eq!(proof.output.len(), 32);
}

#[test]
fn test_vrf_batch_randomness() {
    let e = Env::default();
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let batch_size = 10u32;

    let randomness = vrf::VRFEngine::generate_batch_randomness(&e, batch_size, seed);

    // Verify batch size
    assert_eq!(randomness.len() as u32, batch_size);
}

#[test]
fn test_vrf_proof_verification() {
    let e = Env::default();
    let input = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let (_, proof) = vrf::VRFEngine::generate_vrf_randomness(&e, input.clone(), 0);

    let expected_ledger = proof.ledger_sequence;
    let is_valid = vrf::VRFEngine::verify_vrf_proof(&e, &proof, input, expected_ledger);

    assert!(is_valid);
}

#[test]
fn test_vrf_selection_index_computation() {
    // Test basic selection
    let index = vrf::VRFEngine::compute_selection_index(42, 100);
    assert!(index < 100);

    // Test with single element pool
    let single = vrf::VRFEngine::compute_selection_index(999999, 1);
    assert_eq!(single, 0);
}

#[test]
fn test_commitment_creation() {
    let e = Env::default();
    e.mock_all_auths();
    let committer = Address::generate(&e);
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let nonce = 42u32;

    let (hash, commitment) = commitment::CommitmentScheme::commit(&e, seed.clone(), nonce, committer.clone());

    assert_eq!(hash.len(), 32);
    assert!(!commitment.revealed);
    assert_eq!(commitment.committer, committer);
}

#[test]
fn test_commitment_reveal_verification() {
    let e = Env::default();
    e.mock_all_auths();
    let committer = Address::generate(&e);
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let nonce = 42u32;

    let (hash, _commitment) = commitment::CommitmentScheme::commit(&e, seed.clone(), nonce, committer);

    let reveal = commitment::Reveal {
        seed: seed.clone(),
        nonce,
        revealed_at: e.ledger().timestamp(),
    };

    let is_valid = commitment::CommitmentScheme::verify_reveal(&e, &hash, &reveal);
    assert!(is_valid);
}

#[test]
fn test_entropy_generation() {
    let e = Env::default();
    let entropy = entropy::EntropyManager::generate_ledger_entropy(&e);

    assert!(entropy::EntropyManager::validate_entropy(&entropy));
    assert_eq!(entropy.len(), 32);
}

#[test]
fn test_entropy_with_timestamp() {
    let e = Env::default();
    let entropy = entropy::EntropyManager::generate_entropy_with_timestamp(&e);

    assert!(entropy::EntropyManager::validate_entropy(&entropy));
}

#[test]
fn test_multi_source_entropy() {
    let e = Env::default();
    let entropy = entropy::EntropyManager::generate_multi_source_entropy(&e, 0);

    assert!(entropy::EntropyManager::validate_entropy(&entropy));
}

#[test]
fn test_entropy_state_update() {
    let e = Env::default();
    let mut state = entropy::EntropyManager::initialize_entropy(&e);
    let initial_counter = state.entropy_counter;

    entropy::EntropyManager::update_entropy_state(&e, &mut state);

    assert!(state.entropy_counter > initial_counter);
}

#[test]
fn test_fcfs_allocation() {
    let e = Env::default();

    let mut entries = soroban_sdk::Vec::new(&e);
    for i in 0..5u32 {
        entries
            .push_back(allocation::LotteryEntry {
                participant: Address::generate(&e),
                entry_time: e.ledger().timestamp(),
                nonce: i,
                commitment_hash: None,
            })
            .unwrap();
    }

    let results = allocation::AllocationEngine::allocate_fcfs(&e, &entries, 3);

    assert_eq!(results.len() as u32, 3);
    // First 3 should be allocated in order
    for i in 0..3 {
        let result = results.get(i as usize).unwrap();
        assert_eq!(result.allocation_index, i);
    }
}

#[test]
fn test_lottery_allocation() {
    let e = Env::default();

    let mut entries = soroban_sdk::Vec::new(&e);
    for i in 0..10u32 {
        entries
            .push_back(allocation::LotteryEntry {
                participant: Address::generate(&e),
                entry_time: e.ledger().timestamp(),
                nonce: i,
                commitment_hash: None,
            })
            .unwrap();
    }

    let mut randomness = soroban_sdk::Vec::new(&e);
    for i in 0..5u32 {
        randomness
            .push_back((i as u128 * 12345u128) % 1000000u128)
            .unwrap();
    }

    let results = allocation::AllocationEngine::allocate_lottery(&e, &entries, &randomness, 5);

    assert_eq!(results.len() as u32, 5);
}

#[test]
fn test_anti_sniping_check() {
    let e = Env::default();
    let participant = Address::generate(&e);

    let config = allocation::AntiSnipingConfig {
        minimum_lock_period: 10,
        max_entries_per_address: 2,
        rate_limit_window: 3600,
        randomization_delay_ledgers: 3,
    };

    let mut recent = soroban_sdk::Vec::new(&e);
    for _ in 0..2 {
        recent
            .push_back(allocation::LotteryEntry {
                participant: participant.clone(),
                entry_time: e.ledger().timestamp(),
                nonce: 0,
                commitment_hash: None,
            })
            .unwrap();
    }

    // Should fail: already at max entries
    let result = allocation::AllocationEngine::check_anti_sniping(&e, &participant, &config, &recent);
    assert!(!result);
}

#[test]
fn test_fairness_score_computation() {
    let e = Env::default();
    let mut results = soroban_sdk::Vec::new(&e);

    for i in 0..10u32 {
        results
            .push_back(allocation::AllocationResult {
                winner: Address::generate(&e),
                allocation_index: i,
                randomness_value: 42,
                weight_applied: 1,
            })
            .unwrap();
    }

    let score = allocation::AllocationEngine::compute_fairness_score(&e, &results, 100);

    // Should be high score for roughly fair distribution
    assert!(score >= 50);
}

#[test]
fn test_full_lottery_cycle() {
    let e = Env::default();

    // 1. Create entries
    let mut entries = soroban_sdk::Vec::new(&e);
    for i in 0..20u32 {
        entries
            .push_back(allocation::LotteryEntry {
                participant: Address::generate(&e),
                entry_time: e.ledger().timestamp(),
                nonce: i,
                commitment_hash: None,
            })
            .unwrap();
    }

    // 2. Generate randomness
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let randomness = vrf::VRFEngine::generate_batch_randomness(&e, 10, seed);

    // 3. Extract values
    let mut values = soroban_sdk::Vec::new(&e);
    for r in &randomness {
        values.push_back(r.value).unwrap();
    }

    // 4. Execute allocation
    let results = allocation::AllocationEngine::allocate_lottery(&e, &entries, &values, 10);

    // 5. Verify results
    assert_eq!(results.len() as u32, 10);

    for result in &results {
        // Each result should have valid indices
        assert!(result.allocation_index < 10);
    }
}

#[test]
fn test_commit_reveal_lottery_cycle() {
    let e = Env::default();
    e.mock_all_auths();
    let committer = Address::generate(&e);

    // Phase 1: Commit
    let seed = e.crypto().sha256(&soroban_sdk::Bytes::new(&e));
    let (commitment_hash, _) = commitment::CommitmentScheme::commit(&e, seed.clone(), 42, committer.clone());

    // Phase 2: Reveal
    let reveal = commitment::Reveal {
        seed: seed.clone(),
        nonce: 42,
        revealed_at: e.ledger().timestamp(),
    };

    // Phase 3: Verify
    let is_valid = commitment::CommitmentScheme::verify_reveal(&e, &commitment_hash, &reveal);
    assert!(is_valid);

    // Phase 4: Generate randomness from revealed seed
    let (vrf_output, proof) = vrf::VRFEngine::generate_vrf_randomness(&e, seed.clone(), 42);
    assert_eq!(vrf_output.len(), 32);

    // Phase 5: Verify proof
    let proof_valid =
        vrf::VRFEngine::verify_vrf_proof(&e, &proof, seed, proof.ledger_sequence);
    assert!(proof_valid);
}