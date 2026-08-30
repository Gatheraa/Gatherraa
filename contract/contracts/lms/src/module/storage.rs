use soroban_sdk::Env;

use crate::StorageKey;

use super::types::Module;

/// Returns whether a module is registered under the given identifier.
pub fn has_module(env: &Env, module_id: u32) -> bool {
    env.storage()
        .persistent()
        .has(&StorageKey::Module(module_id))
}

/// Returns the module registered under the given identifier.
pub fn get_module(env: &Env, module_id: u32) -> Option<Module> {
    env.storage()
        .persistent()
        .get(&StorageKey::Module(module_id))
}

/// Persists a module record using its identifier as the unique key.
pub fn set_module(env: &Env, module: &Module) {
    env.storage()
        .persistent()
        .set(&StorageKey::Module(module.module_id), module);
}

/// Removes the module registered under the given identifier.
pub fn remove_module(env: &Env, module_id: u32) {
    env.storage()
        .persistent()
        .remove(&StorageKey::Module(module_id));
}
