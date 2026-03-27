//! Validation traits for Gatheraa contracts
//! 
//! This module defines common validation interfaces to ensure consistent
//! input validation and error handling across all contracts.

use soroban_sdk::{Address, Env, Symbol};

/// Trait for input validation
pub trait Validator {
    /// Validate an address format and existence
    fn validate_address(&self, env: &Env, address: &Address) -> Result<(), crate::error::Error>;
    
    /// Validate a token address and format
    fn validate_token(&self, env: &Env, token: &Address) -> Result<(), crate::error::Error>;
    
    /// Validate numeric input within bounds
    fn validate_amount(&self, amount: i128, min: i128, max: i128) -> Result<(), crate::error::Error>;
    
    /// Validate string input format
    fn validate_string(&self, input: &str, min_len: u32, max_len: u32) -> Result<(), crate::error::Error>;
}

/// Trait for business logic validation
pub trait BusinessValidator {
    /// Validate business rules for an operation
    fn validate_business_rules(&self, env: &Env, operation: &Symbol, params: &Vec<Val>) -> Result<(), crate::error::Error>;
    
    /// Check if an operation is permitted given current state
    fn is_operation_permitted(&self, env: &Env, operation: &Symbol, context: &ValidationContext) -> bool;
}

/// Trait for time-based validation
pub trait TimeValidator {
    /// Validate that a timestamp is within acceptable range
    fn validate_timestamp(&self, timestamp: u64, min: u64, max: u64) -> Result<(), crate::error::Error>;
    
    /// Check if a time period has elapsed
    fn has_time_elapsed(&self, env: &Env, start_time: u64, duration: u64) -> bool;
    
    /// Validate that a deadline has not passed
    fn validate_deadline(&self, env: &Env, deadline: u64) -> Result<(), crate::error::Error>;
}

/// Context for validation operations
#[derive(Clone, Debug)]
pub struct ValidationContext {
    pub caller: Address,
    pub timestamp: u64,
    pub operation: Symbol,
    pub contract_state: ContractState,
}

/// Contract state for validation
#[derive(Clone, Debug)]
pub enum ContractState {
    Active,
    Paused,
    Maintenance,
    Shutdown,
}
