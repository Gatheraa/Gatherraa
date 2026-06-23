//! Gathera common utilities
//! Minimal stub — full implementation pending Soroban SDK migration

use soroban_sdk::{Address, Symbol, String, Env};

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

/// Validation utilities
pub struct ValidationUtils;
impl ValidationUtils {
    /// Reject all-zero / default placeholder addresses.
    pub fn validate_address(address: &Address) -> bool {
        // In Soroban, an `Address::default()` is represented by all-zero bytes.
        // Reject those as a security invariant (bridge_address default placeholders).
        address.to_bytes().iter().any(|&b| b != 0)
    }

    pub fn validate_symbol(symbol: &Symbol) -> bool {
        let s = symbol.to_string();
        !s.is_empty() && s.len() <= 32
    }
}


/// String utilities — stub
pub struct StringUtils;
impl StringUtils {
    pub fn is_alphanumeric(string: &String) -> bool {
        string.to_string().chars().all(|c| c.is_alphanumeric())
    }
}

/// Map utilities — stub
pub struct MapUtils;

/// Time utilities — stub
pub struct TimeUtils;
impl TimeUtils {
    pub fn now(env: &Env) -> u64 { env.ledger().timestamp() }
    pub fn is_past(timestamp: u64, current_time: u64) -> bool { timestamp < current_time }
}

/// Status utilities — stub
pub struct StatusUtils;
impl StatusUtils {
    pub fn is_active(status: CommonStatus) -> bool { status == CommonStatus::Active }
    pub fn is_terminal(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Completed | CommonStatus::Cancelled)
    }
}

/// Gas testing — disabled
pub mod gas_testing {
    #[derive(Debug, Clone)]
    pub struct GasTestFramework;
    impl GasTestFramework {
        pub fn new(_env: &soroban_sdk::Env) -> Self { Self }
    }
}

/// Errors module — stub
pub mod errors {
    pub mod error_codes {
        pub const INVALID_INPUT: u32 = 1000;
        pub const UNAUTHORIZED: u32 = 1001;
        pub const NOT_FOUND: u32 = 1002;
    }
}
