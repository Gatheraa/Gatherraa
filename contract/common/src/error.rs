#![no_std]
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CommonError {
    AlreadyInitialized = 100,
    NotInitialized = 101,
    Unauthorized = 102,
    ContractPaused = 103,
    ArithmeticError = 104,
    InvalidAddress = 105,
    InvalidToken = 106,
    InsufficientBalance = 107,
    TransferFailed = 108,
    InvalidAmount = 109,
    DeadlineReached = 110,
    Timeout = 111,
    VersionMismatch = 112,
    AccessDenied = 113,
}

pub fn panic_with_error(env: &soroban_sdk::Env, error: CommonError) -> ! {
    panic!("{:?}", error);
}
