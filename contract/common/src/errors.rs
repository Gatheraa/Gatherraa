//! Common error types and handling utilities

use soroban_sdk::{Symbol, String};

/// Base error codes for all Gathera contracts
pub mod error_codes {
    pub const INVALID_INPUT: u32 = 1000;
    pub const UNAUTHORIZED: u32 = 1001;
    pub const NOT_FOUND: u32 = 1002;
    pub const ALREADY_EXISTS: u32 = 1003;
    pub const INTERNAL_ERROR: u32 = 1004;
    pub const RATE_LIMITED: u32 = 1005;
    pub const MAINTENANCE: u32 = 1006;
    pub const INSUFFICIENT_BALANCE: u32 = 1007;
    pub const EXPIRED: u32 = 1008;
    pub const INVALID_STATE: u32 = 1009;
}

/// Common error messages
pub mod error_messages {
    use soroban_sdk::String;
    
    pub const INVALID_INPUT: &str = "Invalid input provided";
    pub const UNAUTHORIZED: &str = "Unauthorized access";
    pub const NOT_FOUND: &str = "Resource not found";
    pub const ALREADY_EXISTS: &str = "Resource already exists";
    pub const INTERNAL_ERROR: &str = "Internal error occurred";
    pub const RATE_LIMITED: &str = "Rate limit exceeded";
    pub const MAINTENANCE: &str = "System under maintenance";
    pub const INSUFFICIENT_BALANCE: &str = "Insufficient balance";
    pub const EXPIRED: &str = "Resource has expired";
    pub const INVALID_STATE: &str = "Invalid state for operation";
    
    pub fn get_message(code: u32) -> String {
        match code {
            error_codes::INVALID_INPUT => String::from_slice(&String::from_str(INVALID_INPUT).to_val()),
            error_codes::UNAUTHORIZED => String::from_slice(&String::from_str(UNAUTHORIZED).to_val()),
            error_codes::NOT_FOUND => String::from_slice(&String::from_str(NOT_FOUND).to_val()),
            error_codes::ALREADY_EXISTS => String::from_slice(&String::from_str(ALREADY_EXISTS).to_val()),
            error_codes::INTERNAL_ERROR => String::from_slice(&String::from_str(INTERNAL_ERROR).to_val()),
            error_codes::RATE_LIMITED => String::from_slice(&String::from_str(RATE_LIMITED).to_val()),
            error_codes::MAINTENANCE => String::from_slice(&String::from_str(MAINTENANCE).to_val()),
            error_codes::INSUFFICIENT_BALANCE => String::from_slice(&String::from_str(INSUFFICIENT_BALANCE).to_val()),
            error_codes::EXPIRED => String::from_slice(&String::from_str(EXPIRED).to_val()),
            error_codes::INVALID_STATE => String::from_slice(&String::from_str(INVALID_STATE).to_val()),
            _ => String::from_slice(&String::from_str("Unknown error").to_val()),
        }
    }
}

/// Error handling utilities
pub struct ErrorHandler;

impl ErrorHandler {
    /// Create a formatted error message
    pub fn format_error(code: u32, context: &str) -> String {
        let base_msg = error_messages::get_message(code);
        let context_str = String::from_str(context);
        format!("{}: {}", base_msg, context_str).into()
    }
    
    /// Check if error is recoverable
    pub fn is_recoverable(code: u32) -> bool {
        match code {
            error_codes::RATE_LIMITED | error_codes::MAINTENANCE => true,
            _ => false,
        }
    }
    
    /// Get suggested retry delay in seconds
    pub fn get_retry_delay(code: u32) -> u64 {
        match code {
            error_codes::RATE_LIMITED => 60,
            error_codes::MAINTENANCE => 300,
            _ => 0,
        }
    }
}
