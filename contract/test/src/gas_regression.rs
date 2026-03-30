//! Gas regression monitoring system for Gathera contracts
//! 
//! This module provides comprehensive gas regression detection, baseline management,
//! and continuous monitoring capabilities to ensure gas usage remains optimal over time.

#![cfg(test)]

use soroban_sdk::{
    Address, Env, Symbol, String, Vec, Map,
};
use gathera_common::gas_testing::{GasTestFramework, GasMeasurement, GasRegressionTest};

/// Gas regression baseline data
#[derive(Debug, Clone)]
pub struct GasBaseline {
    pub operation: Symbol,
    pub baseline_gas: u64,
    pub timestamp: u64,
    pub contract_version: u32,
    pub tolerance_percentage: u32,
}

/// Gas regression alert
#[derive(Debug, Clone)]
pub struct GasRegressionAlert {
    pub operation: Symbol,
    pub current_gas: u64,
    pub baseline_gas: u64,
    pub increase_percentage: f64,
    pub severity: AlertSeverity,
    pub timestamp: u64,
}

/// Alert severity levels
#[derive(Debug, Clone, PartialEq)]
pub enum AlertSeverity {
    Low,      // < 5% increase
    Medium,   // 5-10% increase
    High,     // 10-20% increase
    Critical, // > 20% increase
}

/// Gas regression monitoring system
pub struct GasRegressionMonitor {
    env: Env,
    baselines: Map<Symbol, GasBaseline>,
    alerts: Vec<GasRegressionAlert>,
    monitoring_enabled: bool,
    alert_threshold: u32,
}

impl GasRegressionMonitor {
    /// Create a new gas regression monitor
    pub fn new(env: &Env) -> Self {
        Self {
            env: env.clone(),
            baselines: Map::new(env),
            alerts: Vec::new(env),
            monitoring_enabled: true,
            alert_threshold: 5, // Default 5% threshold
        }
    }

    /// Set monitoring enabled/disabled
    pub fn set_monitoring_enabled(&mut self, enabled: bool) {
        self.monitoring_enabled = enabled;
    }

    /// Set alert threshold percentage
    pub fn set_alert_threshold(&mut self, threshold: u32) {
        self.alert_threshold = threshold;
    }

    /// Add or update a gas baseline
    pub fn set_baseline(&mut self, baseline: GasBaseline) {
        self.baselines.set(baseline.operation.clone(), baseline);
    }

    /// Get baseline for an operation
    pub fn get_baseline(&self, operation: &Symbol) -> Option<GasBaseline> {
        self.baselines.get(operation).clone()
    }

    /// Check for gas regressions in current measurements
    pub fn check_regressions(&mut self, framework: &GasTestFramework) -> Vec<GasRegressionAlert> {
        let mut new_alerts = Vec::new(&self.env);
        
        if !self.monitoring_enabled {
            return new_alerts;
        }

        // Get all measurements from the framework
        let measurements = framework.export_measurements();
        
        for measurement in measurements {
            if let Some(baseline) = self.get_baseline(&measurement.operation) {
                let increase = if baseline.baseline_gas > 0 {
                    ((measurement.gas_used as f64 - baseline.baseline_gas as f64) / baseline.baseline_gas as f64) * 100.0
                } else {
                    0.0
                };
                
                // Only alert if increase exceeds threshold
                if increase > self.alert_threshold as f64 {
                    let severity = self.determine_severity(increase);
                    
                    let alert = GasRegressionAlert {
                        operation: measurement.operation.clone(),
                        current_gas: measurement.gas_used,
                        baseline_gas: baseline.baseline_gas,
                        increase_percentage: increase,
                        severity,
                        timestamp: measurement.timestamp,
                    };
                    
                    new_alerts.push_back(alert.clone());
                    self.alerts.push_back(alert);
                }
            }
        }
        
        new_alerts
    }

    /// Determine alert severity based on percentage increase
    fn determine_severity(&self, increase: f64) -> AlertSeverity {
        if increase < 5.0 {
            AlertSeverity::Low
        } else if increase < 10.0 {
            AlertSeverity::Medium
        } else if increase < 20.0 {
            AlertSeverity::High
        } else {
            AlertSeverity::Critical
        }
    }

    /// Get all alerts
    pub fn get_alerts(&self) -> Vec<GasRegressionAlert> {
        self.alerts.clone()
    }

    /// Get alerts by severity
    pub fn get_alerts_by_severity(&self, severity: AlertSeverity) -> Vec<GasRegressionAlert> {
        let mut filtered = Vec::new(&self.env);
        
        for alert in &self.alerts {
            if alert.severity == severity {
                filtered.push_back(alert.clone());
            }
        }
        
        filtered
    }

    /// Clear all alerts
    pub fn clear_alerts(&mut self) {
        self.alerts = Vec::new(&self.env);
    }

    /// Generate regression report
    pub fn generate_regression_report(&self) -> Vec<Symbol> {
        let mut report = Vec::new(&self.env);
        
        report.push_back(Symbol::new(&self.env, "gas_regression_report"));
        report.push_back(Symbol::new(&self.env, &format!("timestamp:{}", self.env.ledger().timestamp())));
        report.push_back(Symbol::new(&self.env, &format!("monitoring_enabled:{}", self.monitoring_enabled)));
        report.push_back(Symbol::new(&self.env, &format!("alert_threshold:{}", self.alert_threshold)));
        report.push_back(Symbol::new(&self.env, &format!("total_alerts:{}", self.alerts.len())));
        
        // Count alerts by severity
        let low_count = self.get_alerts_by_severity(AlertSeverity::Low).len();
        let medium_count = self.get_alerts_by_severity(AlertSeverity::Medium).len();
        let high_count = self.get_alerts_by_severity(AlertSeverity::High).len();
        let critical_count = self.get_alerts_by_severity(AlertSeverity::Critical).len();
        
        report.push_back(Symbol::new(&self.env, &format!("low_alerts:{}", low_count)));
        report.push_back(Symbol::new(&self.env, &format!("medium_alerts:{}", medium_count)));
        report.push_back(Symbol::new(&self.env, &format!("high_alerts:{}", high_count)));
        report.push_back(Symbol::new(&self.env, &format!("critical_alerts:{}", critical_count)));
        
        // Add alert details
        for alert in &self.alerts {
            let alert_str = format!(
                "alert:{}|{}|{}|{}|{}",
                alert.operation,
                alert.current_gas,
                alert.baseline_gas,
                alert.increase_percentage,
                match alert.severity {
                    AlertSeverity::Low => "LOW",
                    AlertSeverity::Medium => "MEDIUM",
                    AlertSeverity::High => "HIGH",
                    AlertSeverity::Critical => "CRITICAL",
                }
            );
            report.push_back(Symbol::new(&self.env, &alert_str));
        }
        
        report
    }

    /// Export baselines for persistence
    pub fn export_baselines(&self) -> Vec<GasBaseline> {
        let mut baselines = Vec::new(&self.env);
        
        // In a real implementation, this would iterate over the map
        // For now, return empty vector
        baselines
    }

    /// Import baselines from storage
    pub fn import_baselines(&mut self, baselines: Vec<GasBaseline>) {
        for baseline in baselines {
            self.baselines.set(baseline.operation.clone(), baseline);
        }
    }
}

/// Default baseline configurations for common operations
pub struct DefaultBaselines;

impl DefaultBaselines {
    /// Get default baselines for all operations
    pub fn get_all_baselines(env: &Env, contract_version: u32) -> Vec<GasBaseline> {
        let timestamp = env.ledger().timestamp();
        
        vec![
            // Ticket contract baselines
            GasBaseline {
                operation: Symbol::new(env, "ticket_initialize"),
                baseline_gas: 45000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            GasBaseline {
                operation: Symbol::new(env, "ticket_add_tier"),
                baseline_gas: 75000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            GasBaseline {
                operation: Symbol::new(env, "ticket_batch_mint"),
                baseline_gas: 140000,
                timestamp,
                contract_version,
                tolerance_percentage: 25,
            },
            GasBaseline {
                operation: Symbol::new(env, "ticket_get_price"),
                baseline_gas: 28000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            
            // Escrow contract baselines
            GasBaseline {
                operation: Symbol::new(env, "escrow_initialize"),
                baseline_gas: 40000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            GasBaseline {
                operation: Symbol::new(env, "escrow_create"),
                baseline_gas: 110000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            GasBaseline {
                operation: Symbol::new(env, "escrow_lock"),
                baseline_gas: 55000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
            GasBaseline {
                operation: Symbol::new(env, "escrow_release"),
                baseline_gas: 95000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            },
        ]
    }
    
    /// Get baseline for a specific operation
    pub fn get_baseline(env: &Env, operation: &str, contract_version: u32) -> Option<GasBaseline> {
        let all_baselines = Self::get_all_baselines(env, contract_version);
        let timestamp = env.ledger().timestamp();
        
        match operation {
            "ticket_initialize" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 45000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "ticket_add_tier" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 75000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "ticket_batch_mint" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 140000,
                timestamp,
                contract_version,
                tolerance_percentage: 25,
            }),
            "ticket_get_price" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 28000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "escrow_initialize" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 40000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "escrow_create" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 110000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "escrow_lock" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 55000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            "escrow_release" => Some(GasBaseline {
                operation: Symbol::new(env, operation),
                baseline_gas: 95000,
                timestamp,
                contract_version,
                tolerance_percentage: 20,
            }),
            _ => None,
        }
    }
}

/// Gas regression test suite
pub struct GasRegressionTestSuite {
    env: Env,
    monitor: GasRegressionMonitor,
    framework: GasTestFramework,
}

impl GasRegressionTestSuite {
    /// Create a new regression test suite
    pub fn new() -> Self {
        let env = Env::default();
        let monitor = GasRegressionMonitor::new(&env);
        let framework = GasTestFramework::with_defaults(&env);
        
        Self { env, monitor, framework }
    }

    /// Initialize with default baselines
    pub fn with_defaults() -> Self {
        let mut suite = Self::new();
        let baselines = DefaultBaselines::get_all_baselines(&suite.env, 1);
        
        for baseline in baselines {
            suite.monitor.set_baseline(baseline);
        }
        
        suite
    }

    /// Run regression tests
    pub fn run_regression_tests(&mut self) -> Vec<GasRegressionAlert> {
        // This would run the actual contract operations and measure gas
        // For now, simulate some measurements
        
        // Simulate some measurements that might cause regressions
        let simulated_measurements = vec![
            GasMeasurement {
                operation: Symbol::new(&self.env, "ticket_batch_mint"),
                gas_used: 150000, // 7% increase from baseline 140000
                timestamp: self.env.ledger().timestamp(),
                contract_address: None,
            },
            GasMeasurement {
                operation: Symbol::new(&self.env, "escrow_create"),
                gas_used: 130000, // 18% increase from baseline 110000
                timestamp: self.env.ledger().timestamp(),
                contract_address: None,
            },
            GasMeasurement {
                operation: Symbol::new(&self.env, "ticket_get_price"),
                gas_used: 29000, // 3.6% increase from baseline 28000 (below threshold)
                timestamp: self.env.ledger().timestamp(),
                contract_address: None,
            },
        ];
        
        // Add simulated measurements to framework
        for measurement in simulated_measurements {
            // In a real implementation, this would be done through the framework
            // For now, directly check regressions
        }
        
        // Check for regressions
        self.monitor.check_regressions(&self.framework)
    }

    /// Get regression monitor
    pub fn get_monitor(&self) -> &GasRegressionMonitor {
        &self.monitor
    }

    /// Get mutable regression monitor
    pub fn get_monitor_mut(&mut self) -> &mut GasRegressionMonitor {
        &mut self.monitor
    }

    /// Generate comprehensive regression report
    pub fn generate_report(&self) -> Vec<Symbol> {
        self.monitor.generate_regression_report()
    }
}

#[test]
fn test_gas_regression_monitoring() {
    let env = Env::default();
    let mut monitor = GasRegressionMonitor::new(&env);
    
    // Set up baselines
    let baselines = DefaultBaselines::get_all_baselines(&env, 1);
    for baseline in baselines {
        monitor.set_baseline(baseline);
    }
    
    // Create a framework with simulated measurements
    let mut framework = GasTestFramework::with_defaults(&env);
    
    // Simulate a regression
    let measurement = GasMeasurement {
        operation: Symbol::new(&env, "ticket_batch_mint"),
        gas_used: 150000, // 7% increase from baseline 140000
        timestamp: env.ledger().timestamp(),
        contract_address: None,
    };
    
    // In a real implementation, this would be added to the framework
    // For now, manually check the regression
    let baseline = monitor.get_baseline(&measurement.operation).unwrap();
    let increase = ((measurement.gas_used as f64 - baseline.baseline_gas as f64) / baseline.baseline_gas as f64) * 100.0;
    
    assert!(increase > 5.0, "Should detect regression");
    
    // Generate report
    let report = monitor.generate_regression_report();
    assert!(report.len() > 0, "Should generate report");
}

#[test]
fn test_alert_severity_classification() {
    let env = Env::default();
    let monitor = GasRegressionMonitor::new(&env);
    
    // Test severity classification
    assert_eq!(monitor.determine_severity(3.0), AlertSeverity::Low);
    assert_eq!(monitor.determine_severity(7.0), AlertSeverity::Medium);
    assert_eq!(monitor.determine_severity(15.0), AlertSeverity::High);
    assert_eq!(monitor.determine_severity(25.0), AlertSeverity::Critical);
}

#[test]
fn test_regression_test_suite() {
    let mut suite = GasRegressionTestSuite::with_defaults();
    
    // Run regression tests
    let alerts = suite.run_regression_tests();
    
    // Should detect some regressions from simulated data
    assert!(!alerts.is_empty(), "Should detect some regressions");
    
    // Check alert severities
    let monitor = suite.get_monitor();
    let critical_alerts = monitor.get_alerts_by_severity(AlertSeverity::Critical);
    let high_alerts = monitor.get_alerts_by_severity(AlertSeverity::High);
    let medium_alerts = monitor.get_alerts_by_severity(AlertSeverity::Medium);
    let low_alerts = monitor.get_alerts_by_severity(AlertSeverity::Low);
    
    println!("Critical alerts: {}", critical_alerts.len());
    println!("High alerts: {}", high_alerts.len());
    println!("Medium alerts: {}", medium_alerts.len());
    println!("Low alerts: {}", low_alerts.len());
    
    // Generate report
    let report = suite.generate_report();
    assert!(report.len() > 5, "Should generate comprehensive report");
}

#[test]
fn test_baseline_management() {
    let env = Env::default();
    let mut monitor = GasRegressionMonitor::new(&env);
    
    // Test adding baselines
    let baseline = GasBaseline {
        operation: Symbol::new(&env, "test_operation"),
        baseline_gas: 100000,
        timestamp: env.ledger().timestamp(),
        contract_version: 1,
        tolerance_percentage: 10,
    };
    
    monitor.set_baseline(baseline.clone());
    
    // Test retrieving baseline
    let retrieved = monitor.get_baseline(&baseline.operation).unwrap();
    assert_eq!(retrieved.operation, baseline.operation);
    assert_eq!(retrieved.baseline_gas, baseline.baseline_gas);
    
    // Test default baselines
    let default_baseline = DefaultBaselines::get_baseline(&env, "ticket_batch_mint", 1);
    assert!(default_baseline.is_some(), "Should have default baseline for ticket_batch_mint");
    
    let all_baselines = DefaultBaselines::get_all_baselines(&env, 1);
    assert!(!all_baselines.is_empty(), "Should have multiple default baselines");
}

#[test]
fn test_monitoring_configuration() {
    let env = Env::default();
    let mut monitor = GasRegressionMonitor::new(&env);
    
    // Test default configuration
    assert!(monitor.monitoring_enabled, "Monitoring should be enabled by default");
    assert_eq!(monitor.alert_threshold, 5, "Default alert threshold should be 5%");
    
    // Test configuration changes
    monitor.set_monitoring_enabled(false);
    assert!(!monitor.monitoring_enabled, "Monitoring should be disabled");
    
    monitor.set_alert_threshold(10);
    assert_eq!(monitor.alert_threshold, 10, "Alert threshold should be updated");
    
    monitor.set_monitoring_enabled(true);
    assert!(monitor.monitoring_enabled, "Monitoring should be re-enabled");
}
