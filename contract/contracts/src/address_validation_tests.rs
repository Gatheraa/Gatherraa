#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::chain_abstraction::ChainAbstraction;

#[test]
#[should_panic(expected = "invalid address")]
fn test_reject_zero_address_ethereum() {
    let env = Env::default();

    let zero = Address::default();

    // Current validator returns bool. This test panics if validation unexpectedly passes.
    assert!(!ChainAbstraction::validate_chain_address(env, 1, &zero));
}

#[test]
#[should_panic(expected = "invalid address")]
fn test_reject_zero_address_stellar() {
    let env = Env::default();

    let zero = Address::default();

    assert!(!ChainAbstraction::validate_chain_address(env, 2, &zero));
}

#[test]
#[should_panic(expected = "invalid address")]
fn test_reject_zero_address_generic() {
    let env = Env::default();

    let zero = Address::default();

    // Unknown chain id should still reject the zero placeholder.
    assert!(!ChainAbstraction::validate_chain_address(env, 999, &zero));
}

#[test]
fn test_accept_non_zero_address() {
    let env = Env::default();

    let non_zero = Address::generate(&env);

    assert!(ChainAbstraction::validate_chain_address(env, 1, &non_zero));
}

