//! Comprehensive testing utilities for Gathera contracts
//! 
//! This module provides shared testing utilities, benchmarks, and integration
//! tests that can be used across all contract packages.

pub mod gas_benchmarks;
pub mod gas_limits;
pub mod gas_regression;

// Re-export commonly used testing utilities
pub use gas_benchmarks::*;
pub use gas_limits::*;
pub use gas_regression::*;
