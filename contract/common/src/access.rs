#![no_std]
use soroban_sdk::{contracttype, Address, Env, Symbol};

/// Storage keys for access control and contract state.
#[derive(Clone)]
#[contracttype]
pub enum AccessKey {
    /// The admin address of the contract.
    Admin,
    /// Role-based access control key: (Role Name, User Address).
    Role(Symbol, Address),
    /// Global pause state of the contract.
    Paused,
}

/// Reads the administrator address from instance storage.
pub fn read_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&AccessKey::Admin)
}

/// Writes the administrator address to instance storage.
pub fn write_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&AccessKey::Admin, admin);
}

/// Checks if an address has a specific role.
pub fn has_role(env: &Env, role: Symbol, address: Address) -> bool {
    env.storage().persistent().has(&AccessKey::Role(role, address))
}

/// Grants a specific role to an address.
pub fn write_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().set(&AccessKey::Role(role, address), &true);
}

/// Revokes a specific role from an address.
pub fn remove_role(env: &Env, role: Symbol, address: Address) {
    env.storage().persistent().remove(&AccessKey::Role(role, address));
}

/// Checks if the contract is currently paused.
pub fn is_paused(env: &Env) -> bool {
    env.storage().instance().get(&AccessKey::Paused).unwrap_or(false)
}

/// Sets the contract's paused state.
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&AccessKey::Paused, &paused);
}

/// Requires that the caller is the administrator.
///
/// # Panics
///
/// Panics if the admin is not set or if authorization fails.
pub fn require_admin(env: &Env) -> Address {
    let admin = read_admin(env).unwrap_or_else(|| panic!("admin not set"));
    admin.require_auth();
    admin
}

/// Requires that the specified address has the given role and has authorized the call.
///
/// # Panics
///
/// Panics if authorization fails or if the address does not have the required role.
pub fn require_role(env: &Env, role: Symbol, address: Address) {
    address.require_auth();
    if !has_role(env, role, address) {
        panic!("not authorized");
    }
}
