#![no_std]
use soroban_sdk::contracterror;

/// Standard error codes shared across the Gatherraa smart contract ecosystem.
#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    /// The contract has already been initialized.
    AlreadyInitialized = 100,
    /// The contract has not been initialized.
    NotInitialized = 101,
    /// Authorization required but not provided or incorrect.
    Unauthorized = 102,
    /// The contract is currently paused for maintenance or emergency.
    ContractPaused = 103,
    /// An arithmetic overflow or error occurred.
    ArithmeticError = 104,
    /// Provided address is invalid (e.g., zero address).
    InvalidAddress = 105,
    /// Provided token address is invalid or not a token contract.
    InvalidToken = 106,
    /// Caller has insufficient balance for the transaction.
    InsufficientBalance = 107,
    /// Token transfer failed at the target contract.
    TransferFailed = 108,
    /// The provided amount is invalid (negative or zero where not allowed).
    InvalidAmount = 109,
    /// The transaction deadline has passed.
    DeadlineReached = 110,
    /// The operation timed out.
    Timeout = 111,
    /// Contract logic version mismatch.
    VersionMismatch = 112,
    /// General access denied error.
    AccessDenied = 113,
}

/// Utility function to panic with a descriptive error message from a [CommonError].
pub fn panic_with_error(env: &soroban_sdk::Env, error: CommonError) -> ! {
    panic!("{:?}", error);
}
