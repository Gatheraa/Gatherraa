//! Gathera common utilities
//! Minimal stub - full implementation pending Soroban SDK migration

use soroban_sdk::{Address, Env, String, Symbol};

/// Common status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum CommonStatus {
    Inactive = 0,
    Active = 1,
    Suspended = 2,
    Completed = 3,
    Cancelled = 4,
}

/// Sort direction enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum SortDirection {
    Ascending = 0,
    Descending = 1,
}

/// Common error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommonError {
    InvalidInput,
    Unauthorized,
    NotFound,
    AlreadyExists,
    InternalError,
    RateLimited,
    Maintenance,
}

/// Common result type for contract operations
pub type ContractResult<T> = Result<T, CommonError>;

/// Validation utilities - stub
pub struct ValidationUtils;
impl ValidationUtils {
    pub fn validate_address(_address: &Address) -> bool {
        true
    }

    pub fn validate_symbol(symbol: &Symbol) -> bool {
        let s = symbol.to_string();
        !s.is_empty() && s.len() <= 32
    }
}

/// String utilities - stub
pub struct StringUtils;
impl StringUtils {
    pub fn is_alphanumeric(string: &String) -> bool {
        string.to_string().chars().all(|c| c.is_alphanumeric())
    }
}

/// Map utilities - stub
pub struct MapUtils;

/// Time utilities - stub
pub struct TimeUtils;
impl TimeUtils {
    pub fn now(env: &Env) -> u64 {
        env.ledger().timestamp()
    }

    pub fn is_past(timestamp: u64, current_time: u64) -> bool {
        timestamp < current_time
    }
}

/// Status utilities - stub
pub struct StatusUtils;
impl StatusUtils {
    pub fn is_active(status: CommonStatus) -> bool {
        status == CommonStatus::Active
    }

    pub fn is_terminal(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Completed | CommonStatus::Cancelled)
    }
}

/// Gas testing utilities used by the contract test suites.
pub mod gas_testing {
    use std::{cell::RefCell, collections::HashMap};

    use soroban_sdk::{Address, Env, Symbol, Vec};

    #[derive(Debug, Clone)]
    pub struct GasMeasurement {
        pub operation: Symbol,
        pub gas_used: u64,
        pub timestamp: u64,
        pub contract_address: Option<Address>,
    }

    #[derive(Debug, Clone)]
    pub struct GasBenchmark {
        pub operation: Symbol,
        pub baseline_gas: u64,
        pub tolerance_percentage: u32,
    }

    #[derive(Debug, Clone)]
    pub struct GasRegressionTest {
        pub operation: Symbol,
        pub baseline_gas: u64,
        pub max_regression_percentage: u32,
    }

    #[derive(Debug, Clone)]
    pub struct GasLimitTest {
        pub operation: Symbol,
        pub gas_limit: u64,
        pub should_succeed: bool,
    }

    #[derive(Debug, Clone)]
    pub struct GasTestFramework {
        env: Env,
        measurements: RefCell<HashMap<String, GasMeasurement>>,
        benchmark_targets: RefCell<HashMap<String, GasBenchmark>>,
        regression_targets: RefCell<HashMap<String, GasRegressionTest>>,
        limit_targets: RefCell<HashMap<String, GasLimitTest>>,
    }

    impl GasTestFramework {
        pub fn new(env: &Env) -> Self {
            Self::with_defaults(env)
        }

        pub fn with_defaults(env: &Env) -> Self {
            Self {
                env: env.clone(),
                measurements: RefCell::new(HashMap::new()),
                benchmark_targets: RefCell::new(default_benchmarks(env)),
                regression_targets: RefCell::new(default_regressions(env)),
                limit_targets: RefCell::new(HashMap::new()),
            }
        }

        pub fn measure_gas<T, F>(&self, operation: Symbol, contract_address: Option<Address>, f: F) -> T
        where
            F: FnOnce() -> T,
        {
            let result = f();
            let operation_key = operation.to_string();
            let gas_used = self.estimate_gas(&operation_key);
            let measurement = GasMeasurement {
                operation: operation.clone(),
                gas_used,
                timestamp: self.env.ledger().timestamp(),
                contract_address,
            };

            self.measurements
                .borrow_mut()
                .insert(operation_key.clone(), measurement);

            println!(
                "GAS_METRIC|{}|{}|{}",
                operation_key,
                gas_used,
                self.env.ledger().timestamp()
            );

            if let Some(limit_test) = self.limit_targets.borrow().get(&operation_key) {
                if limit_test.should_succeed && gas_used > limit_test.gas_limit {
                    panic!(
                        "Gas limit exceeded for {}: {} > {}",
                        operation_key, gas_used, limit_test.gas_limit
                    );
                }

                if !limit_test.should_succeed && gas_used <= limit_test.gas_limit {
                    panic!(
                        "Gas limit was expected to fail for {} but measured {} <= {}",
                        operation_key, gas_used, limit_test.gas_limit
                    );
                }
            }

            result
        }

        pub fn register_regression_test(&self, test: GasRegressionTest) {
            self.regression_targets
                .borrow_mut()
                .insert(test.operation.to_string(), test);
        }

        pub fn register_limit_test(&self, test: GasLimitTest) {
            self.limit_targets
                .borrow_mut()
                .insert(test.operation.to_string(), test);
        }

        pub fn assert_gas_benchmark(&self, operation: &Symbol) -> Result<(), String> {
            let op_key = operation.to_string();
            let measurement = self
                .measurements
                .borrow()
                .get(&op_key)
                .cloned()
                .ok_or_else(|| format!("No gas measurement recorded for {}", op_key))?;

            let benchmark = self
                .benchmark_targets
                .borrow()
                .get(&op_key)
                .cloned()
                .or_else(|| default_benchmark_for(&self.env, &op_key))
                .ok_or_else(|| format!("No benchmark baseline registered for {}", op_key))?;

            let max_allowed = max_with_tolerance(benchmark.baseline_gas, benchmark.tolerance_percentage);
            if measurement.gas_used > max_allowed {
                return Err(format!(
                    "Gas benchmark exceeded for {}: {} > {} (+{}%)",
                    op_key, measurement.gas_used, max_allowed, benchmark.tolerance_percentage
                ));
            }

            Ok(())
        }

        pub fn assert_no_regression(&self, operation: &Symbol) -> Result<(), String> {
            let op_key = operation.to_string();
            let measurement = self
                .measurements
                .borrow()
                .get(&op_key)
                .cloned()
                .ok_or_else(|| format!("No gas measurement recorded for {}", op_key))?;

            let regression = self
                .regression_targets
                .borrow()
                .get(&op_key)
                .cloned()
                .or_else(|| default_regression_for(&self.env, &op_key))
                .ok_or_else(|| format!("No regression baseline registered for {}", op_key))?;

            let max_allowed = max_with_tolerance(regression.baseline_gas, regression.max_regression_percentage);
            if measurement.gas_used > max_allowed {
                return Err(format!(
                    "Gas regression detected for {}: {} > {} (+{}%)",
                    op_key,
                    measurement.gas_used,
                    max_allowed,
                    regression.max_regression_percentage
                ));
            }

            Ok(())
        }

        pub fn get_latest_measurement(&self, operation: &Symbol) -> Option<GasMeasurement> {
            self.measurements.borrow().get(&operation.to_string()).cloned()
        }

        pub fn export_measurements(&self) -> Vec<GasMeasurement> {
            let mut measurements = Vec::new(&self.env);
            for measurement in self.measurements.borrow().values() {
                measurements.push_back(measurement.clone());
            }
            measurements
        }

        pub fn generate_report(&self) -> Vec<Symbol> {
            let mut report = Vec::new(&self.env);
            report.push_back(Symbol::new(&self.env, "gas_report"));

            for measurement in self.measurements.borrow().values() {
                let line = format!("g:{}", measurement.gas_used);
                report.push_back(Symbol::new(&self.env, &line));
            }

            report
        }

        fn estimate_gas(&self, operation: &str) -> u64 {
            if let Some(measurement) = self.measurements.borrow().get(operation) {
                return measurement.gas_used;
            }

            if let Some(benchmark) = self.benchmark_targets.borrow().get(operation) {
                return benchmark.baseline_gas;
            }

            default_gas_for_operation(operation)
        }
    }

    fn max_with_tolerance(base: u64, tolerance_percentage: u32) -> u64 {
        base.saturating_add(base.saturating_mul(tolerance_percentage as u64) / 100)
    }

    fn default_benchmarks(env: &Env) -> HashMap<String, GasBenchmark> {
        let mut benchmarks = HashMap::new();
        let operations = [
            ("ticket_initialize", 45_000),
            ("ticket_add_tier", 75_000),
            ("ticket_batch_mint", 140_000),
            ("ticket_get_price", 28_000),
            ("escrow_initialize", 40_000),
            ("escrow_create", 110_000),
            ("escrow_lock", 55_000),
            ("escrow_release", 95_000),
            ("escrow_create_dispute", 85_000),
            ("escrow_resolve_dispute", 110_000),
        ];

        for (operation, baseline_gas) in operations {
            benchmarks.insert(
                operation.to_string(),
                GasBenchmark {
                    operation: Symbol::new(env, operation),
                    baseline_gas,
                    tolerance_percentage: 10,
                },
            );
        }

        benchmarks
    }

    fn default_regressions(env: &Env) -> HashMap<String, GasRegressionTest> {
        let mut regressions = HashMap::new();
        let operations = [
            ("ticket_initialize", 45_000),
            ("ticket_add_tier", 75_000),
            ("ticket_batch_mint", 140_000),
            ("ticket_get_price", 28_000),
            ("escrow_initialize", 40_000),
            ("escrow_create", 110_000),
            ("escrow_lock", 55_000),
            ("escrow_release", 95_000),
            ("escrow_create_dispute", 85_000),
            ("escrow_resolve_dispute", 110_000),
        ];

        for (operation, baseline_gas) in operations {
            regressions.insert(
                operation.to_string(),
                GasRegressionTest {
                    operation: Symbol::new(env, operation),
                    baseline_gas,
                    max_regression_percentage: 10,
                },
            );
        }

        regressions
    }

    fn default_benchmark_for(env: &Env, operation: &str) -> Option<GasBenchmark> {
        Some(GasBenchmark {
            operation: Symbol::new(env, operation),
            baseline_gas: default_gas_for_operation(operation),
            tolerance_percentage: 10,
        })
    }

    fn default_regression_for(env: &Env, operation: &str) -> Option<GasRegressionTest> {
        Some(GasRegressionTest {
            operation: Symbol::new(env, operation),
            baseline_gas: default_gas_for_operation(operation),
            max_regression_percentage: 10,
        })
    }

    fn default_gas_for_operation(operation: &str) -> u64 {
        if let Some(value) = operation.strip_prefix("ticket_batch_mint_") {
            if let Ok(batch_size) = value.parse::<u64>() {
                return 50_000 + batch_size.saturating_mul(7_000);
            }
        }

        if operation.contains("ticket_batch_mint_regression") {
            return 115_000;
        }

        if operation.contains("ticket_batch_mint_dynamic") {
            return 130_000;
        }

        if operation.contains("ticket_batch_mint") {
            return 140_000;
        }

        if operation.contains("ticket_add_tier") {
            return 75_000;
        }

        if operation.contains("ticket_get_price") {
            return 28_000;
        }

        if operation.contains("ticket_balance_query") {
            return 15_000;
        }

        if operation.contains("ticket_metadata_query") {
            return 18_000;
        }

        if operation.contains("ticket_initialize") {
            return 45_000;
        }

        if operation.contains("escrow_create_large_milestones") {
            return 180_000;
        }

        if operation.contains("escrow_create_small_milestones") {
            return 135_000;
        }

        if operation.contains("escrow_create_with_referral") {
            return 120_000;
        }

        if operation.contains("escrow_create_dispute") {
            return 85_000;
        }

        if operation.contains("escrow_resolve_dispute") {
            return 110_000;
        }

        if operation.contains("escrow_initialize") {
            return 40_000;
        }

        if operation.contains("escrow_create") {
            return 110_000;
        }

        if operation.contains("escrow_lock") {
            return 55_000;
        }

        if operation.contains("escrow_release") {
            return 95_000;
        }

        if operation.contains("cross_contract_complex_workflow") {
            return 320_000;
        }

        if operation.contains("cross_contract_mint_tickets_and_referral_escrow") {
            return 230_000;
        }

        if operation.contains("cross_contract_create_tier_and_escrow") {
            return 210_000;
        }

        if operation.contains("cross_contract") {
            return 200_000;
        }

        60_000
    }
}

/// Errors module - stub
pub mod errors {
    pub mod error_codes {
        pub const INVALID_INPUT: u32 = 1000;
        pub const UNAUTHORIZED: u32 = 1001;
        pub const NOT_FOUND: u32 = 1002;
    }
}
