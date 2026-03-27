#![no_std]
use soroban_sdk::{contracttype, Env};

/// Time-to-live for instance storage (approx 30 days).
pub const TTL_INSTANCE: u32 = 17280 * 30;
/// Time-to-live for persistent storage (approx 90 days).
pub const TTL_PERSISTENT: u32 = 17280 * 90;

/// Storage keys for common contract data.
#[derive(Clone)]
#[contracttype]
pub enum CommonDataKey {
    /// The logic version of the contract.
    Version,
    /// Timelock data for contract upgrades.
    UpgradeTimelock,
}

/// Extends the time-to-live for the contract instance storage.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

/// Reads the contract version from instance storage. Defaults to 1 if not set.
pub fn read_version(env: &Env) -> u32 {
    env.storage().instance().get(&CommonDataKey::Version).unwrap_or(1)
}

/// Writes the contract version to instance storage.
pub fn write_version(env: &Env, version: u32) {
    env.storage().instance().set(&CommonDataKey::Version, &version);
}
