#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, Events, Ledger},
    Address, BytesN, Env, String, Symbol,
};
use gathera_common::gas_testing::{GasTestFramework, GasBenchmark, GasRegressionTest};

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

fn create_contract_with_gas_framework(e: &Env, admin: &Address) -> (SoulboundTicketContractClient<'static>, GasTestFramework) {
    let gas_framework = GasTestFramework::with_defaults(e);
    let contract_id = e.register(SoulboundTicketContract, ());
    let client = SoulboundTicketContractClient::new(e, &contract_id);

    // Measure gas usage for initialization
    let _ = gas_framework.measure_gas(
        Symbol::new(e, "ticket_initialize"),
        Some(contract_id.clone()),
        || {
            client.initialize(
                admin,
                &String::from_str(e, "EventTicket"),
                &String::from_str(e, "TKT"),
                &String::from_str(e, "https://example.com"),
                &e.ledger().timestamp(),
                &(e.ledger().timestamp() + 100000), // Refund cutoff
            );
        }
    );

    (client, gas_framework)
}

#[test]
fn test_initialize_and_tier_creation_with_gas() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    // Verify initialization gas usage
    let init_op = Symbol::new(&e, "ticket_initialize");
    assert!(gas_framework.assert_gas_benchmark(&init_op).is_ok());

    let tier_sym = Symbol::new(&e, "VIP");
    
    // Measure gas usage for add_tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "VIP Ticket"),
                &100,
                &50,
                &PricingStrategy::Standard,
            );
        }
    );

    // Verify add_tier gas usage
    let add_tier_op = Symbol::new(&e, "ticket_add_tier");
    assert!(gas_framework.assert_gas_benchmark(&add_tier_op).is_ok());

    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, 100);

    // Generate gas report
    let report = gas_framework.generate_report();
    assert!(report.len() > 0);
}

#[test]
fn test_batch_mint_with_gas() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "General"),
                &50,
                &100,
                &PricingStrategy::Standard,
            );
        }
    );

    // Measure gas usage for batch_mint
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_batch_mint"),
        Some(client.contract_id.clone()),
        || {
            client.batch_mint(&user, &tier_sym, &5);
        }
    );

    // Verify batch_mint gas usage
    let batch_mint_op = Symbol::new(&e, "ticket_batch_mint");
    assert!(gas_framework.assert_gas_benchmark(&batch_mint_op).is_ok());

    // Check for gas regression
    assert!(gas_framework.assert_no_regression(&batch_mint_op).is_ok());

    let balance = client.balance(&user);
    assert_eq!(balance, 5);

    let ticket = client.get_ticket(&1);
    assert_eq!(ticket.tier_symbol, tier_sym);
}

#[test]
fn test_get_price_with_gas() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "General"),
                &50,
                &100,
                &PricingStrategy::Standard,
            );
        }
    );

    // Measure gas usage for get_ticket_price
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_get_price"),
        Some(client.contract_id.clone()),
        || {
            client.get_ticket_price(&tier_sym);
        }
    );

    // Verify get_price gas usage
    let get_price_op = Symbol::new(&e, "ticket_get_price");
    assert!(gas_framework.assert_gas_benchmark(&get_price_op).is_ok());

    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, 50);
}

#[test]
fn test_dynamic_pricing_with_gas() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "General"),
                &100,
                &10,
                &PricingStrategy::Standard,
            ); // thresholds every 2 tickets
        }
    );

    // Initial price should be base
    assert_eq!(client.get_ticket_price(&tier_sym), 100);

    // Measure gas usage for batch_mint with dynamic pricing
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_batch_mint_dynamic"),
        Some(client.contract_id.clone()),
        || {
            // Mint 2 tickets (hits 20% threshold, max_supply=10, 10/5=2)
            client.batch_mint(&user, &tier_sym, &2);
        }
    );

    // Price should increase by 5%
    assert_eq!(client.get_ticket_price(&tier_sym), 105);

    // Mint 2 more (hits 40%)
    client.batch_mint(&user, &tier_sym, &2);

    // Price should increase by 10%
    assert_eq!(client.get_ticket_price(&tier_sym), 110);
}

#[test]
fn test_gas_regression_batch_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "REGRESSION_TEST");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "Regression Test"),
                &100,
                &100,
                &PricingStrategy::Standard,
            );
        }
    );

    // Register custom regression test with stricter baseline
    gas_framework.register_regression_test(GasRegressionTest {
        operation: Symbol::new(&e, "ticket_batch_mint_regression"),
        baseline_gas: 120000, // Stricter baseline
        max_regression_percentage: 5, // Only 5% regression allowed
    });

    // Measure gas usage for batch_mint
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_batch_mint_regression"),
        Some(client.contract_id.clone()),
        || {
            client.batch_mint(&user, &tier_sym, &10);
        }
    );

    // Check for gas regression
    let regression_op = Symbol::new(&e, "ticket_batch_mint_regression");
    let result = gas_framework.assert_no_regression(&regression_op);
    
    // This should pass unless there's a significant regression
    assert!(result.is_ok(), "Gas regression detected in batch_mint operation");
}

#[test]
fn test_gas_benchmark_comprehensive() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    // Test multiple operations and collect comprehensive gas data
    let operations = vec![
        ("add_tier_vip", || {
            client.add_tier(
                &Symbol::new(&e, "VIP"),
                &String::from_str(&e, "VIP Ticket"),
                &100,
                &50,
                &PricingStrategy::Standard,
            );
        }),
        ("add_tier_premium", || {
            client.add_tier(
                &Symbol::new(&e, "PREMIUM"),
                &String::from_str(&e, "Premium Ticket"),
                &200,
                &25,
                &PricingStrategy::Standard,
            );
        }),
        ("batch_mint_vip", || {
            client.batch_mint(&user, &Symbol::new(&e, "VIP"), &5);
        }),
        ("batch_mint_premium", || {
            client.batch_mint(&user, &Symbol::new(&e, "PREMIUM"), &3);
        }),
        ("get_price_vip", || {
            client.get_ticket_price(&Symbol::new(&e, "VIP"));
        }),
        ("get_price_premium", || {
            client.get_ticket_price(&Symbol::new(&e, "PREMIUM"));
        }),
    ];

    for (op_name, op_fn) in operations {
        let _ = gas_framework.measure_gas(
            Symbol::new(&e, op_name),
            Some(client.contract_id.clone()),
            op_fn,
        );
    }

    // Generate comprehensive report
    let report = gas_framework.generate_report();
    
    // Verify all operations were measured
    assert!(report.len() > operations.len() as u32);
    
    // Check that all benchmarks pass
    let benchmark_ops = vec![
        "ticket_add_tier",
        "ticket_batch_mint", 
        "ticket_get_price",
    ];
    
    for op_name in benchmark_ops {
        let op_symbol = Symbol::new(&e, op_name);
        let result = gas_framework.assert_gas_benchmark(&op_symbol);
        assert!(result.is_ok(), "Benchmark failed for operation: {}", op_name);
    }
}

#[test]
fn test_gas_limit_scenarios() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "LIMIT_TEST");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "Limit Test"),
                &100,
                &1000, // Large supply for testing
                &PricingStrategy::Standard,
            );
        }
    );

    // Test different batch sizes to understand gas scaling
    let batch_sizes = vec![1, 5, 10, 25, 50, 100];
    
    for batch_size in batch_sizes {
        let _ = gas_framework.measure_gas(
            Symbol::new(&e, &format!("batch_mint_{}", batch_size)),
            Some(client.contract_id.clone()),
            || {
                client.batch_mint(&user, &tier_sym, &batch_size);
            }
        );
    }

    // Analyze gas scaling patterns
    let report = gas_framework.generate_report();
    
    // Verify that larger batches use proportionally more gas
    // (but not exponentially more, which would indicate inefficiency)
    let mut gas_measurements = Vec::new();
    
    for batch_size in batch_sizes {
        let op_name = format!("batch_mint_{}", batch_size);
        let op_symbol = Symbol::new(&e, &op_name);
        if let Some(measurement) = gas_framework.get_latest_measurement(&op_symbol) {
            gas_measurements.push((batch_size, measurement.gas_used));
        }
    }
    
    // Basic sanity check: larger batches should use more gas
    assert!(gas_measurements.len() >= 2);
    for i in 1..gas_measurements.len() {
        let (prev_size, prev_gas) = gas_measurements[i-1];
        let (curr_size, curr_gas) = gas_measurements[i];
        
        // Gas should increase with batch size
        assert!(curr_gas >= prev_gas, 
            "Gas usage should not decrease with larger batch sizes: {}->{} tokens: {}->{} gas",
            prev_size, curr_size, prev_gas, curr_gas);
        
        // But not by more than 3x per 10x increase (check for linear scaling)
        if curr_size >= prev_size * 10 {
            let max_expected_gas = prev_gas * 3;
            assert!(curr_gas <= max_expected_gas,
                "Gas scaling appears non-linear: {}->{} tokens: {}->{} gas (max expected: {})",
                prev_size, curr_size, prev_gas, curr_gas, max_expected_gas);
        }
    }
}

#[test]
#[should_panic(expected = "Soulbound: Tickets cannot be transferred")]
fn test_soulbound_restriction_with_gas() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let (client, mut gas_framework) = create_contract_with_gas_framework(&e, &admin);

    let tier_sym = Symbol::new(&e, "VIP");
    
    // Add tier
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_add_tier"),
        Some(client.contract_id.clone()),
        || {
            client.add_tier(
                &tier_sym,
                &String::from_str(&e, "VIP"),
                &100,
                &10,
                &PricingStrategy::Standard,
            );
        }
    );

    // Mint ticket
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_batch_mint"),
        Some(client.contract_id.clone()),
        || {
            client.batch_mint(&user1, &tier_sym, &1);
        }
    );

    // Measure gas usage for failed transfer (should still consume gas)
    let _ = gas_framework.measure_gas(
        Symbol::new(&e, "ticket_transfer_failed"),
        Some(client.contract_id.clone()),
        || {
            // This should panic
            client.transfer(&user1, &user2, &1);
        }
    );
}

// All other existing tests remain the same...
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
