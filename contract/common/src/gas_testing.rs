//! Gas usage testing utilities and benchmarks for Gathera contracts
//! 
//! This module provides comprehensive gas measurement, benchmarking, and regression testing
//! capabilities for all smart contracts in the Gathera ecosystem.

#![cfg(test)]

use soroban_sdk::{
    testutils::{Ledger, Account as _},
    Env, Address, Symbol, BytesN, Vec, Map,
};
use core::cmp::{min, max};

/// Gas measurement result for a single operation
#[derive(Debug, Clone)]
pub struct GasMeasurement {
    pub operation: Symbol,
    pub gas_used: u64,
    pub timestamp: u64,
    pub contract_address: Option<Address>,
}

/// Gas benchmark configuration
#[derive(Debug, Clone)]
pub struct GasBenchmark {
    pub operation: Symbol,
    pub expected_max_gas: u64,
    pub expected_min_gas: Option<u64>,
    pub tolerance_percentage: u32,
}

/// Gas regression test configuration
#[derive(Debug, Clone)]
pub struct GasRegressionTest {
    pub operation: Symbol,
    pub baseline_gas: u64,
    pub max_regression_percentage: u32,
}

/// Gas limit scenario test configuration
#[derive(Debug, Clone)]
pub struct GasLimitTest {
    pub operation: Symbol,
    pub gas_limit: u64,
    pub should_succeed: bool,
}

/// Comprehensive gas testing framework
pub struct GasTestFramework {
    env: Env,
    measurements: Vec<GasMeasurement>,
    benchmarks: Map<Symbol, GasBenchmark>,
    regression_tests: Map<Symbol, GasRegressionTest>,
    limit_tests: Map<Symbol, GasLimitTest>,
}

impl GasTestFramework {
    /// Create a new gas testing framework instance
    pub fn new(env: &Env) -> Self {
        Self {
            env: env.clone(),
            measurements: Vec::new(env),
            benchmarks: Map::new(env),
            regression_tests: Map::new(env),
            limit_tests: Map::new(env),
        }
    }

    /// Register a gas benchmark for an operation
    pub fn register_benchmark(&mut self, benchmark: GasBenchmark) {
        self.benchmarks.set(benchmark.operation.clone(), benchmark);
    }

    /// Register a gas regression test
    pub fn register_regression_test(&mut self, test: GasRegressionTest) {
        self.regression_tests.set(test.operation.clone(), test);
    }

    /// Register a gas limit test
    pub fn register_limit_test(&mut self, test: GasLimitTest) {
        self.limit_tests.set(test.operation.clone(), test);
    }

    /// Measure gas usage for an operation
    pub fn measure_gas<F, R>(&mut self, operation: Symbol, contract_address: Option<Address>, f: F) -> R 
    where
        F: FnOnce() -> R,
    {
        // Get initial ledger info
        let initial_ledger = self.env.ledger().get();
        let initial_sequence = initial_ledger.sequence;
        
        // Execute the operation
        let result = f();
        
        // Get final ledger info and calculate gas used
        let final_ledger = self.env.ledger().get();
        let gas_used = final_ledger.sequence.saturating_sub(initial_sequence) * 1000; // Approximation
        
        // Store measurement
        let measurement = GasMeasurement {
            operation: operation.clone(),
            gas_used,
            timestamp: final_ledger.timestamp,
            contract_address,
        };
        
        self.measurements.push_back(measurement);
        
        result
    }

    /// Get the latest gas measurement for an operation
    pub fn get_latest_measurement(&self, operation: &Symbol) -> Option<GasMeasurement> {
        let measurements = &self.measurements;
        for i in (0..measurements.len()).rev() {
            let measurement = measurements.get(i).unwrap();
            if measurement.operation == *operation {
                return Some(measurement.clone());
            }
        }
        None
    }

    /// Get all measurements for an operation
    pub fn get_measurements_for_operation(&self, operation: &Symbol) -> Vec<GasMeasurement> {
        let mut result = Vec::new(&self.env);
        let measurements = &self.measurements;
        
        for measurement in measurements {
            if measurement.operation == *operation {
                result.push_back(measurement.clone());
            }
        }
        
        result
    }

    /// Assert gas usage is within benchmark limits
    pub fn assert_gas_benchmark(&self, operation: &Symbol) -> Result<(), Symbol> {
        let benchmark_opt = self.benchmarks.get(operation);
        let benchmark = match benchmark_opt {
            Some(b) => b,
            None => return Err(Symbol::new(&self.env, "no_benchmark_registered")),
        };
        
        let measurement_opt = self.get_latest_measurement(operation);
        let measurement = match measurement_opt {
            Some(m) => m,
            None => return Err(Symbol::new(&self.env, "no_gas_measurement")),
        };

        // Check against maximum
        if measurement.gas_used > benchmark.expected_max_gas {
            return Err(Symbol::new(&self.env, "gas_exceeded_maximum"));
        }

        // Check against minimum if specified
        if let Some(min_gas) = benchmark.expected_min_gas {
            if measurement.gas_used < min_gas {
                return Err(Symbol::new(&self.env, "gas_below_minimum"));
            }
        }

        // Check tolerance
        let expected_gas = benchmark.expected_max_gas;
        let tolerance = (expected_gas as u64 * benchmark.tolerance_percentage as u64) / 100;
        let deviation = if measurement.gas_used >= expected_gas {
            measurement.gas_used - expected_gas
        } else {
            expected_gas - measurement.gas_used
        };

        if deviation > tolerance {
            return Err(Symbol::new(&self.env, "gas_exceeded_tolerance"));
        }

        Ok(())
    }

    /// Assert gas usage hasn't regressed beyond acceptable limits
    pub fn assert_no_regression(&self, operation: &Symbol) -> Result<(), Symbol> {
        let regression_test_opt = self.regression_tests.get(operation);
        let regression_test = match regression_test_opt {
            Some(rt) => rt,
            None => return Err(Symbol::new(&self.env, "no_regression_test")),
        };
        
        let measurement_opt = self.get_latest_measurement(operation);
        let measurement = match measurement_opt {
            Some(m) => m,
            None => return Err(Symbol::new(&self.env, "no_gas_measurement")),
        };

        let allowed_increase = (regression_test.baseline_gas as u64 * regression_test.max_regression_percentage as u64) / 100;
        let max_allowed = regression_test.baseline_gas + allowed_increase;

        if measurement.gas_used > max_allowed {
            return Err(Symbol::new(&self.env, "gas_regression_detected"));
        }

        Ok(())
    }

    /// Generate gas usage report
    pub fn generate_report(&self) -> Vec<Symbol> {
        let mut report = Vec::new(&self.env);
        
        report.push_back(Symbol::new(&self.env, "gas_usage_report"));
        report.push_back(Symbol::new(&self.env, &format!("total_measurements:{}", self.measurements.len())));

        // Group by operation
        let mut operations = Vec::new(&self.env);
        let measurements = &self.measurements;
        
        for measurement in measurements {
            let operation = &measurement.operation;
            if !operations.contains(operation) {
                operations.push_back(operation.clone());
            }
        }

        for operation in operations {
            let op_measurements = self.get_measurements_for_operation(&operation);
            
            if let Some(latest) = op_measurements.last() {
                report.push_back(Symbol::new(&self.env, &format!("{}:latest_gas:{}", operation, latest.gas_used)));
            }
            
            if op_measurements.len() > 1 {
                let mut min_gas = u64::MAX;
                let mut max_gas = 0u64;
                let mut total_gas = 0u64;
                
                for measurement in &op_measurements {
                    min_gas = min(min_gas, measurement.gas_used);
                    max_gas = max(max_gas, measurement.gas_used);
                    total_gas += measurement.gas_used;
                }
                
                let avg_gas = total_gas / op_measurements.len() as u64;
                
                report.push_back(Symbol::new(&self.env, &format!("{}:min_gas:{}", operation, min_gas)));
                report.push_back(Symbol::new(&self.env, &format!("{}:max_gas:{}", operation, max_gas)));
                report.push_back(Symbol::new(&self.env, &format!("{}:avg_gas:{}", operation, avg_gas)));
            }
        }

        report
    }

    /// Clear all measurements
    pub fn clear_measurements(&mut self) {
        self.measurements = Vec::new(&self.env);
    }
}

/// Default gas benchmarks for common operations
impl GasTestFramework {
    /// Initialize with default benchmarks
    pub fn with_defaults(env: &Env) -> Self {
        let mut framework = Self::new(env);
        
        // Register default benchmarks for ticket contract
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "ticket_initialize"),
            expected_max_gas: 50000,
            expected_min_gas: Some(30000),
            tolerance_percentage: 20,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "ticket_add_tier"),
            expected_max_gas: 80000,
            expected_min_gas: Some(50000),
            tolerance_percentage: 20,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "ticket_batch_mint"),
            expected_max_gas: 150000,
            expected_min_gas: Some(100000),
            tolerance_percentage: 25,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "ticket_get_price"),
            expected_max_gas: 30000,
            expected_min_gas: Some(20000),
            tolerance_percentage: 20,
        });
        
        // Register default benchmarks for escrow contract
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "escrow_initialize"),
            expected_max_gas: 45000,
            expected_min_gas: Some(25000),
            tolerance_percentage: 20,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "escrow_create"),
            expected_max_gas: 120000,
            expected_min_gas: Some(80000),
            tolerance_percentage: 20,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "escrow_lock"),
            expected_max_gas: 60000,
            expected_min_gas: Some(40000),
            tolerance_percentage: 20,
        });
        
        framework.register_benchmark(GasBenchmark {
            operation: Symbol::new(env, "escrow_release"),
            expected_max_gas: 100000,
            expected_min_gas: Some(70000),
            tolerance_percentage: 20,
        });
        
        // Register regression tests
        framework.register_regression_test(GasRegressionTest {
            operation: Symbol::new(env, "ticket_batch_mint"),
            baseline_gas: 150000,
            max_regression_percentage: 10,
        });
        
        framework.register_regression_test(GasRegressionTest {
            operation: Symbol::new(env, "escrow_create"),
            baseline_gas: 120000,
            max_regression_percentage: 10,
        });
        
        framework
    }
}

/// Gas usage assertion macros for convenient testing
#[macro_export]
macro_rules! assert_gas_usage {
    ($framework:expr, $operation:expr, $max_gas:expr) => {
        let operation_symbol = soroban_sdk::Symbol::new(&$framework.env, $operation);
        let measurement = $framework.get_latest_measurement(&operation_symbol)
            .expect("No gas measurement found for operation");
        
        assert!(
            measurement.gas_used <= $max_gas,
            "Gas usage exceeded limit for {}: {} > {}",
            $operation, measurement.gas_used, $max_gas
        );
    };
}

#[macro_export]
macro_rules! assert_gas_range {
    ($framework:expr, $operation:expr, $min_gas:expr, $max_gas:expr) => {
        let operation_symbol = soroban_sdk::Symbol::new(&$framework.env, $operation);
        let measurement = $framework.get_latest_measurement(&operation_symbol)
            .expect("No gas measurement found for operation");
        
        assert!(
            measurement.gas_used >= $min_gas && measurement.gas_used <= $max_gas,
            "Gas usage out of range for {}: {} (expected {}-{})",
            $operation, measurement.gas_used, $min_gas, $max_gas
        );
    };
}

#[macro_export]
macro_rules! measure_and_assert_gas {
    ($framework:expr, $operation:expr, $contract_address:expr, $max_gas:expr, $code:block) => {
        let operation_symbol = soroban_sdk::Symbol::new(&$framework.env, $operation);
        $framework.measure_gas(operation_symbol, $contract_address, $code);
        assert_gas_usage!($framework, $operation, $max_gas);
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as AddressTestUtils;

    #[test]
    fn test_gas_framework_creation() {
        let env = Env::default();
        let framework = GasTestFramework::new(&env);
        assert_eq!(framework.measurements.len(), 0);
        assert_eq!(framework.benchmarks.len(), 0);
    }

    #[test]
    fn test_default_benchmarks() {
        let env = Env::default();
        let framework = GasTestFramework::with_defaults(&env);
        
        let ticket_init_op = Symbol::new(&env, "ticket_initialize");
        assert!(framework.benchmarks.contains_key(&ticket_init_op));
        
        let escrow_create_op = Symbol::new(&env, "escrow_create");
        assert!(framework.benchmarks.contains_key(&escrow_create_op));
    }

    #[test]
    fn test_benchmark_registration() {
        let env = Env::default();
        let mut framework = GasTestFramework::new(&env);
        
        let benchmark = GasBenchmark {
            operation: Symbol::new(&env, "test_operation"),
            expected_max_gas: 100000,
            expected_min_gas: Some(50000),
            tolerance_percentage: 10,
        };
        
        framework.register_benchmark(benchmark);
        
        let test_op = Symbol::new(&env, "test_operation");
        assert!(framework.benchmarks.contains_key(&test_op));
    }

    #[test]
    fn test_gas_measurement() {
        let env = Env::default();
        let mut framework = GasTestFramework::new(&env);
        let contract_address = AddressTestUtils::generate(&env);
        
        let operation = Symbol::new(&env, "test_operation");
        let result: u32 = framework.measure_gas(operation.clone(), Some(contract_address), || {
            42
        });
        
        assert_eq!(result, 42);
        assert_eq!(framework.measurements.len(), 1);
        
        let measurement = framework.get_latest_measurement(&operation).unwrap();
        assert_eq!(measurement.operation, operation);
        assert!(measurement.gas_used > 0);
    }
}
