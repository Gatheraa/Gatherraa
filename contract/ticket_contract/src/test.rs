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
