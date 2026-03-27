#![no_std]
use soroban_sdk::{symbol_short, Env, Symbol};

/// The internal key used to track the reentrancy lock.
const REENTRANCY_GUARD: Symbol = symbol_short!("reentrant");

/// Sets the reentrancy guard, preventing recursive calls to protected functions.
///
/// # Panics
///
/// Panics if a reentrant call is detected (i.e., the guard is already set).
pub fn set_reentrancy_guard(env: &Env) {
    if env.storage().instance().has(&REENTRANCY_GUARD) {
        panic!("reentrant call detected");
    }
    env.storage().instance().set(&REENTRANCY_GUARD, &true);
}

/// Removes the reentrancy guard, allowing future calls to protected functions.
pub fn remove_reentrancy_guard(env: &Env) {
    env.storage().instance().remove(&REENTRANCY_GUARD);
}
