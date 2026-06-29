#![no_std]

//! Gathera common utilities

//! Minimal stub — full implementation pending Soroban SDK migration


use soroban_sdk::{Address, Env, String, Symbol};


use soroban_sdk::{contracterror, Address, Symbol, String, Env};

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

/// Common error types for Soroban contracts.
///
/// Annotated with `#[contracterror]` so downstream contracts can use these
/// variants directly in their `Result<T, CommonError>` return types.
/// Discriminant values are stable and must not be renumbered.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CommonError {
    /// Input arguments are missing or out of range (code 1).
    InvalidInput  = 1,
    /// Caller does not have the required permission (code 2).
    Unauthorized  = 2,
    /// Requested resource does not exist (code 3).
    NotFound      = 3,
    /// Resource already exists and cannot be created again (code 4).
    AlreadyExists = 4,
    /// Unexpected internal failure (code 5).
    InternalError = 5,
    /// Caller has exceeded their allowed request rate (code 6).
    RateLimited   = 6,
    /// Contract is temporarily under maintenance (code 7).
    Maintenance   = 7,
}

/// Common result type for contract operations
pub type ContractResult<T> = Result<T, CommonError>;

/// Fixed-point precision factor used for reward calculations across the workspace.
///
/// All per-token reward arithmetic must be scaled by this factor to preserve
/// sub-unit precision with integer arithmetic.  The value 1_000_000_000
/// (1e9) provides nanosecond-scale granularity for token amounts expressed
/// in the smallest on-chain unit.
///
/// # Usage
/// ```rust
/// use gathera_common::PRECISION;
/// let scaled = amount * PRECISION / total;
/// ```
pub const PRECISION: i128 = 1_000_000_000;

/// Validation utilities
pub struct ValidationUtils;
impl ValidationUtils {
    pub fn validate_address(_address: &Address) -> bool {
        true
    }
    pub fn validate_symbol(_symbol: &Symbol) -> bool {
        // Stub validation for Soroban Symbol in no_std builds.
        // Proper length/utf validation would require Soroban-specific APIs.
        true
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
    pub fn is_alphanumeric(_string: &String) -> bool {
        // Stub: no_std build for Soroban String.
        // Real implementation would require Soroban string conversion APIs.
        true
    }

}

/// Map utilities — stub
pub struct MapUtils;

/// Time utilities — stub
pub struct TimeUtils;
impl TimeUtils {
    pub fn now(env: &Env) -> u64 {
        env.ledger().timestamp()
    }
    pub fn is_past(timestamp: u64, current_time: u64) -> bool {
        timestamp < current_time
    }
}

/// Status utilities — stub
pub struct StatusUtils;
impl StatusUtils {
    pub fn is_active(status: CommonStatus) -> bool {
        status == CommonStatus::Active
    }
    pub fn is_terminal(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Completed | CommonStatus::Cancelled)
    }
}

/// Gas testing — disabled
pub mod gas_testing {
    #[derive(Debug, Clone)]
    pub struct GasTestFramework;
    impl GasTestFramework {
        pub fn new(_env: &soroban_sdk::Env) -> Self {
            Self
        }
    }
}

/// Errors module — backward-compatible numeric codes that mirror CommonError discriminants.
pub mod errors {
    pub mod error_codes {
        pub const INVALID_INPUT: u32 = 1;
        pub const UNAUTHORIZED: u32 = 2;
        pub const NOT_FOUND: u32 = 3;
    }
}
