#![no_std]
use soroban_sdk::{Address, BytesN, Env, token};

/// Validates that an address is not a zero/dead address.
///
/// # Panics
///
/// Panics if the address is the zero contract address.
pub fn validate_address(env: &Env, address: &Address) {
    if address == &Address::from_contract_id(&BytesN::from_array(env, &[0; 32])) {
        panic!("zero address not allowed");
    }
}

/// Validates that an address points to a deployed and functional token contract.
///
/// This function verifies that the address is non-zero and attempts to call `decimals()`
/// on the target contract to ensure it satisfies the token interface.
///
/// # Panics
///
/// Panics if the address is zero or if the target contract is not a valid token.
pub fn validate_token_address(env: &Env, address: &Address) {
    validate_address(env, address);
    let token_client = token::Client::new(env, address);
    let _ = token_client.decimals();
}
