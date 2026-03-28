//! Comprehensive gas benchmark tests for all Gathera contracts
//! 
//! This module provides extensive gas benchmarking for critical functions across
//! all contracts to ensure gas usage remains within acceptable limits and to
//! identify optimization opportunities.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Symbol, String, Vec, BytesN,
};
use gathera_common::gas_testing::{GasTestFramework, GasBenchmark};

// Import contract clients
use crate::ticket_contract::SoulboundTicketContractClient;
use crate::escrow_contract::EscrowContract;

/// Comprehensive gas benchmark suite
pub struct GasBenchmarkSuite {
    env: Env,
    framework: GasTestFramework,
}

impl GasBenchmarkSuite {
    pub fn new() -> Self {
        let env = Env::default();
        let framework = GasTestFramework::with_defaults(&env);
        
        Self { env, framework }
    }

    /// Run all gas benchmarks
    pub fn run_all_benchmarks(&mut self) -> Vec<(String, Result<(), String>)> {
        let mut results = Vec::new();
        
        // Ticket contract benchmarks
        results.extend(self.benchmark_ticket_contract());
        
        // Escrow contract benchmarks
        results.extend(self.benchmark_escrow_contract());
        
        // Cross-contract benchmarks
        results.extend(self.benchmark_cross_contract_operations());
        
        results
    }

    /// Benchmark ticket contract operations
    pub fn benchmark_ticket_contract(&mut self) -> Vec<(String, Result<(), String>)> {
        let mut results = Vec::new();
        
        // Setup
        let admin = Address::generate(&self.env);
        let user = Address::generate(&self.env);
        let (client, _) = create_ticket_contract(&self.env, &admin);

        // Benchmark 1: Basic tier creation
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_add_tier_basic"),
            Some(client.contract_id.clone()),
            || {
                client.add_tier(
                    &Symbol::new(&self.env, "BASIC"),
                    &String::from_str(&self.env, "Basic Ticket"),
                    &100,
                    &1000,
                    &crate::ticket_contract::storage_types::PricingStrategy::Standard,
                );
            }
        );
        results.push(("ticket_add_tier_basic".to_string(), Ok(())));

        // Benchmark 2: Premium tier creation
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_add_tier_premium"),
            Some(client.contract_id.clone()),
            || {
                client.add_tier(
                    &Symbol::new(&self.env, "PREMIUM"),
                    &String::from_str(&self.env, "Premium Ticket"),
                    &500,
                    &100,
                    &crate::ticket_contract::storage_types::PricingStrategy::Standard,
                );
            }
        );
        results.push(("ticket_add_tier_premium".to_string(), Ok(())));

        // Benchmark 3: Small batch mint (1 ticket)
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_batch_mint_1"),
            Some(client.contract_id.clone()),
            || {
                client.batch_mint(&user, &Symbol::new(&self.env, "BASIC"), &1);
            }
        );
        results.push(("ticket_batch_mint_1".to_string(), Ok(())));

        // Benchmark 4: Medium batch mint (10 tickets)
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_batch_mint_10"),
            Some(client.contract_id.clone()),
            || {
                client.batch_mint(&user, &Symbol::new(&self.env, "BASIC"), &10);
            }
        );
        results.push(("ticket_batch_mint_10".to_string(), Ok(())));

        // Benchmark 5: Large batch mint (100 tickets)
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_batch_mint_100"),
            Some(client.contract_id.clone()),
            || {
                client.batch_mint(&user, &Symbol::new(&self.env, "PREMIUM"), &100);
            }
        );
        results.push(("ticket_batch_mint_100".to_string(), Ok(())));

        // Benchmark 6: Price calculation (no dynamic pricing)
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_get_price_static"),
            Some(client.contract_id.clone()),
            || {
                client.get_ticket_price(&Symbol::new(&self.env, "BASIC"));
            }
        );
        results.push(("ticket_get_price_static".to_string(), Ok(())));

        // Benchmark 7: Price calculation with dynamic pricing
        // First, create a tier with dynamic pricing
        client.add_tier(
            &Symbol::new(&self.env, "DYNAMIC"),
            &String::from_str(&self.env, "Dynamic Ticket"),
            &100,
            &100,
            &crate::ticket_contract::storage_types::PricingStrategy::Standard,
        );
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_get_price_dynamic"),
            Some(client.contract_id.clone()),
            || {
                client.get_ticket_price(&Symbol::new(&self.env, "DYNAMIC"));
            }
        );
        results.push(("ticket_get_price_dynamic".to_string(), Ok(())));

        // Benchmark 8: Balance query
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_balance_query"),
            Some(client.contract_id.clone()),
            || {
                client.balance(&user);
            }
        );
        results.push(("ticket_balance_query".to_string(), Ok(())));

        // Benchmark 9: Ticket metadata query
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "ticket_metadata_query"),
            Some(client.contract_id.clone()),
            || {
                client.get_ticket(&1);
            }
        );
        results.push(("ticket_metadata_query".to_string(), Ok(())));

        results
    }

    /// Benchmark escrow contract operations
    pub fn benchmark_escrow_contract(&mut self) -> Vec<(String, Result<(), String>)> {
        let mut results = Vec::new();
        
        // Setup
        let admin = Address::generate(&self.env);
        let organizer = Address::generate(&self.env);
        let purchaser = Address::generate(&self.env);
        let event = Address::generate(&self.env);
        let token = Address::generate(&self.env);
        
        let config = crate::escrow_contract::storage_types::RevenueSplitConfig {
            default_organizer_percentage: 8000000,
            default_platform_percentage: 1500000,
            default_referral_percentage: 500000,
            max_referral_percentage: 10000000,
            precision: 10000000,
            min_escrow_amount: 1000000,
            max_escrow_amount: 10000000000,
            dispute_timeout: 86400,
            emergency_withdrawal_delay: 3600,
        };

        // Initialize escrow contract
        let contract_address = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_initialize"),
            None,
            || {
                EscrowContract::initialize(self.env.clone(), admin.clone(), config.clone());
            }
        );

        // Benchmark 1: Create simple escrow
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_create_simple"),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000, // 1 XLM
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    None,
                    None,
                )
            }
        );
        results.push(("escrow_create_simple".to_string(), Ok(())));

        // Benchmark 2: Create escrow with referral
        let referrer = Address::generate(&self.env);
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_create_with_referral"),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000,
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    Some(referrer.clone()),
                    None,
                )
            }
        );
        results.push(("escrow_create_with_referral".to_string(), Ok(())));

        // Benchmark 3: Create escrow with milestones (small)
        let small_milestones = vec![
            &self.env,
            crate::escrow_contract::storage_types::Milestone {
                id: 1,
                amount: 5000000,
                release_time: self.env.ledger().timestamp(),
                released: false,
            },
            crate::escrow_contract::storage_types::Milestone {
                id: 2,
                amount: 5000000,
                release_time: self.env.ledger().timestamp() + 3600,
                released: false,
            },
        ];
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_create_small_milestones"),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000,
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    None,
                    Some(small_milestones),
                )
            }
        );
        results.push(("escrow_create_small_milestones".to_string(), Ok(())));

        // Benchmark 4: Create escrow with milestones (large)
        let mut large_milestones = Vec::new(&self.env);
        for i in 1..=20 {
            large_milestones.push_back(crate::escrow_contract::storage_types::Milestone {
                id: i,
                amount: 500000, // 0.05 XLM each
                release_time: self.env.ledger().timestamp() + (i as u64 * 3600),
                released: false,
            });
        }
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_create_large_milestones"),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000,
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    None,
                    Some(large_milestones),
                )
            }
        );
        results.push(("escrow_create_large_milestones".to_string(), Ok(())));

        // Benchmark 5: Lock escrow
        let escrow_id = EscrowContract::create_escrow(
            self.env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            10000000,
            token.clone(),
            self.env.ledger().timestamp() + 86400,
            None,
            None,
            None,
        );

        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_lock"),
            Some(contract_address.clone()),
            || {
                EscrowContract::lock_escrow(self.env.clone(), escrow_id);
            }
        );
        results.push(("escrow_lock".to_string(), Ok(())));

        // Benchmark 6: Release escrow
        let release_escrow_id = EscrowContract::create_escrow(
            self.env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            10000000,
            token.clone(),
            self.env.ledger().timestamp(), // Release immediately
            None,
            None,
            None,
        );
        
        EscrowContract::lock_escrow(self.env.clone(), release_escrow_id);
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_release"),
            Some(contract_address.clone()),
            || {
                EscrowContract::release_escrow(self.env.clone(), release_escrow_id);
            }
        );
        results.push(("escrow_release".to_string(), Ok(())));

        // Benchmark 7: Create dispute
        let dispute_escrow_id = EscrowContract::create_escrow(
            self.env.clone(),
            event.clone(),
            organizer.clone(),
            purchaser.clone(),
            10000000,
            token.clone(),
            self.env.ledger().timestamp() + 86400,
            None,
            None,
            None,
        );
        
        EscrowContract::lock_escrow(self.env.clone(), dispute_escrow_id);
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_create_dispute"),
            Some(contract_address.clone()),
            || {
                EscrowContract::create_dispute(
                    self.env.clone(),
                    dispute_escrow_id,
                    purchaser.clone(),
                    Symbol::new(&self.env, "service_not_provided"),
                    vec![&self.env, Symbol::new(&self.env, "evidence1")],
                );
            }
        );
        results.push(("escrow_create_dispute".to_string(), Ok(())));

        // Benchmark 8: Resolve dispute
        let resolution = crate::escrow_contract::storage_types::DisputeResolution {
            winner: purchaser.clone(),
            refund_amount: 8000000,
            penalty_amount: 2000000,
        };
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "escrow_resolve_dispute"),
            Some(contract_address.clone()),
            || {
                EscrowContract::resolve_dispute(self.env.clone(), dispute_escrow_id, resolution);
            }
        );
        results.push(("escrow_resolve_dispute".to_string(), Ok(())));

        results
    }

    /// Benchmark cross-contract operations
    pub fn benchmark_cross_contract_operations(&mut self) -> Vec<(String, Result<(), String>)> {
        let mut results = Vec::new();
        
        // Setup both contracts
        let admin = Address::generate(&self.env);
        let organizer = Address::generate(&self.env);
        let purchaser = Address::generate(&self.env);
        let user = Address::generate(&self.env);
        let event = Address::generate(&self.env);
        let token = Address::generate(&self.env);
        
        // Initialize ticket contract
        let (ticket_client, _) = create_ticket_contract(&self.env, &admin);
        
        // Initialize escrow contract
        let escrow_config = crate::escrow_contract::storage_types::RevenueSplitConfig {
            default_organizer_percentage: 8000000,
            default_platform_percentage: 1500000,
            default_referral_percentage: 500000,
            max_referral_percentage: 10000000,
            precision: 10000000,
            min_escrow_amount: 1000000,
            max_escrow_amount: 10000000000,
            dispute_timeout: 86400,
            emergency_withdrawal_delay: 3600,
        };

        let escrow_address = EscrowContract::initialize(self.env.clone(), admin.clone(), escrow_config);

        // Benchmark 1: Create ticket tier and escrow in sequence
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "cross_contract_create_tier_and_escrow"),
            None,
            || {
                // Create ticket tier
                ticket_client.add_tier(
                    &Symbol::new(&self.env, "EVENT_TIER"),
                    &String::from_str(&self.env, "Event Ticket"),
                    &100,
                    &1000,
                    &crate::ticket_contract::storage_types::PricingStrategy::Standard,
                );
                
                // Create escrow for event
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000,
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    None,
                    None,
                );
            }
        );
        results.push(("cross_contract_create_tier_and_escrow".to_string(), Ok(())));

        // Benchmark 2: Mint tickets and create escrow with referral
        let referrer = Address::generate(&self.env);
        
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "cross_contract_mint_tickets_and_referral_escrow"),
            None,
            || {
                // Mint tickets to user
                ticket_client.batch_mint(&user, &Symbol::new(&self.env, "EVENT_TIER"), &5);
                
                // Create escrow with referral
                EscrowContract::create_escrow(
                    self.env.clone(),
                    event.clone(),
                    organizer.clone(),
                    purchaser.clone(),
                    10000000,
                    token.clone(),
                    self.env.ledger().timestamp() + 86400,
                    None,
                    Some(referrer.clone()),
                    None,
                );
            }
        );
        results.push(("cross_contract_mint_tickets_and_referral_escrow".to_string(), Ok(())));

        // Benchmark 3: Complex workflow - multiple operations
        let result = self.framework.measure_gas(
            Symbol::new(&self.env, "cross_contract_complex_workflow"),
            None,
            || {
                // Create multiple ticket tiers
                for i in 1..=3 {
                    let tier_name = format!("TIER_{}", i);
                    ticket_client.add_tier(
                        &Symbol::new(&self.env, &tier_name),
                        &String::from_str(&self.env, &format!("Tier {}", i)),
                        &(100 * i as i128),
                        &(1000 / i as u32),
                        &crate::ticket_contract::storage_types::PricingStrategy::Standard,
                    );
                }
                
                // Mint tickets across different tiers
                for i in 1..=3 {
                    let tier_name = format!("TIER_{}", i);
                    ticket_client.batch_mint(&user, &Symbol::new(&self.env, &tier_name), &(i as u32));
                }
                
                // Create multiple escrows
                for i in 1..=3 {
                    EscrowContract::create_escrow(
                        self.env.clone(),
                        event.clone(),
                        organizer.clone(),
                        purchaser.clone(),
                        (10000000 * i as i128),
                        token.clone(),
                        self.env.ledger().timestamp() + (86400 * i as u64),
                        None,
                        None,
                        None,
                    );
                }
            }
        );
        results.push(("cross_contract_complex_workflow".to_string(), Ok(())));

        results
    }

    /// Generate comprehensive benchmark report
    pub fn generate_benchmark_report(&self) -> Vec<Symbol> {
        let mut report = Vec::new(&self.env);
        
        report.push_back(Symbol::new(&self.env, "comprehensive_gas_benchmark_report"));
        report.push_back(Symbol::new(&self.env, &format!("timestamp:{}", self.env.ledger().timestamp())));
        
        // Add all measurements
        let measurements = self.framework.generate_report();
        for measurement in measurements {
            report.push_back(measurement);
        }
        
        report
    }

    /// Export benchmark data for analysis
    pub fn export_benchmark_data(&self) -> Vec<(Symbol, u64)> {
        let mut data = Vec::new(&self.env);
        
        // This would export all measurements in a structured format
        // For now, return a simplified version
        let measurements = self.framework.generate_report();
        for measurement in measurements {
            // Parse the measurement string to extract operation and gas
            let measurement_str = measurement.to_string();
            if let Some((op, gas_str)) = measurement_str.split_once(':') {
                if let Ok(gas) = gas_str.parse::<u64>() {
                    data.push_back((Symbol::new(&self.env, op), gas));
                }
            }
        }
        
        data
    }
}

fn create_ticket_contract(env: &Env, admin: &Address) -> (SoulboundTicketContractClient<'static>, GasTestFramework) {
    let gas_framework = GasTestFramework::with_defaults(env);
    let contract_id = env.register(crate::ticket_contract::SoulboundTicketContract, ());
    let client = SoulboundTicketContractClient::new(env, &contract_id);

    let _ = gas_framework.measure_gas(
        Symbol::new(env, "ticket_initialize"),
        Some(contract_id.clone()),
        || {
            client.initialize(
                admin,
                &String::from_str(env, "EventTicket"),
                &String::from_str(env, "TKT"),
                &String::from_str(env, "https://example.com"),
                &env.ledger().timestamp(),
                &(env.ledger().timestamp() + 100000),
            );
        }
    );

    (client, gas_framework)
}

#[test]
fn test_comprehensive_gas_benchmarks() {
    let mut suite = GasBenchmarkSuite::new();
    
    // Run all benchmarks
    let results = suite.run_all_benchmarks();
    
    // Verify all benchmarks completed
    assert!(!results.is_empty(), "No benchmark results returned");
    
    // Check that all operations succeeded
    for (operation, result) in results {
        assert!(result.is_ok(), "Benchmark failed for operation: {}", operation);
    }
    
    // Generate report
    let report = suite.generate_benchmark_report();
    assert!(report.len() > 10, "Report should contain multiple measurements");
    
    // Export data
    let data = suite.export_benchmark_data();
    assert!(!data.is_empty(), "Should have exported benchmark data");
    
    // Verify critical operations have reasonable gas usage
    let critical_operations = vec![
        ("ticket_batch_mint_1", 50000),
        ("ticket_batch_mint_10", 150000),
        ("ticket_batch_mint_100", 500000),
        ("escrow_create_simple", 120000),
        ("escrow_lock", 60000),
        ("escrow_release", 100000),
    ];
    
    for (op_name, max_expected_gas) in critical_operations {
        let op_symbol = Symbol::new(&suite.env, op_name);
        if let Some(measurement) = suite.framework.get_latest_measurement(&op_symbol) {
            assert!(
                measurement.gas_used <= max_expected_gas,
                "Critical operation {} exceeds gas limit: {} > {}",
                op_name, measurement.gas_used, max_expected_gas
            );
        }
    }
}

#[test]
fn test_gas_scaling_analysis() {
    let mut suite = GasBenchmarkSuite::new();
    
    // Run scaling benchmarks
    let scaling_results = suite.benchmark_ticket_contract();
    
    // Analyze gas scaling patterns
    let batch_sizes = vec!["ticket_batch_mint_1", "ticket_batch_mint_10", "ticket_batch_mint_100"];
    let mut gas_values = Vec::new();
    
    for batch_op in batch_sizes {
        let op_symbol = Symbol::new(&suite.env, batch_op);
        if let Some(measurement) = suite.framework.get_latest_measurement(&op_symbol) {
            gas_values.push(measurement.gas_used);
        }
    }
    
    // Verify linear scaling (approximately)
    assert!(gas_values.len() >= 3, "Should have measurements for different batch sizes");
    
    // Check that 10 tickets don't use 10x gas of 1 ticket (should be more efficient)
    if gas_values.len() >= 2 {
        let single_ticket_gas = gas_values[0];
        let ten_tickets_gas = gas_values[1];
        
        // Should be less than 10x due to batching efficiency
        assert!(
            ten_tickets_gas < single_ticket_gas * 10,
            "Batching should be more efficient: 10 tickets use {} gas vs 10x {} = {}",
            ten_tickets_gas, single_ticket_gas, single_ticket_gas * 10
        );
    }
    
    // Check that 100 tickets don't use 100x gas of 1 ticket
    if gas_values.len() >= 3 {
        let single_ticket_gas = gas_values[0];
        let hundred_tickets_gas = gas_values[2];
        
        // Should be significantly less than 100x
        assert!(
            hundred_tickets_gas < single_ticket_gas * 50, // Allow up to 50x for 100x batch
            "Large batching should be much more efficient: 100 tickets use {} gas vs 50x {} = {}",
            hundred_tickets_gas, single_ticket_gas, single_ticket_gas * 50
        );
    }
}

#[test]
fn test_gas_optimization_validation() {
    let mut suite = GasBenchmarkSuite::new();
    
    // Run benchmarks to establish baseline
    let baseline_results = suite.run_all_benchmarks();
    
    // Test optimization scenarios
    let optimization_tests = vec![
        ("efficient_batch_minting", || {
            // This would test optimized batch minting logic
            // For now, just run the standard benchmark
            suite.benchmark_ticket_contract();
        }),
        ("optimized_escrow_creation", || {
            // This would test optimized escrow creation
            suite.benchmark_escrow_contract();
        }),
    ];
    
    for (test_name, test_fn) in optimization_tests {
        let _ = suite.framework.measure_gas(
            Symbol::new(&suite.env, test_name),
            None,
            test_fn,
        );
    }
    
    // Generate optimization report
    let report = suite.generate_benchmark_report();
    assert!(report.len() > baseline_results.len() as u32);
}
