#![no_std]
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::DataKey;

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, Address, BytesN, Env, IntoVal, String, Symbol, Vec,
};

#[contract]
pub struct EventFactoryContract;

const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MOD_ROLE: Symbol = symbol_short!("MOD");
const PAUSER_ROLE: Symbol = symbol_short!("PAUSER");

#[contractimpl]
impl EventFactoryContract {
    pub fn initialize(e: Env, admin: Address, event_wasm_hash: BytesN<32>) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage()
            .instance()
            .set(&DataKey::EventWasmHash, &event_wasm_hash);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "initialized"), admin),
            event_wasm_hash,
        );
        // Grant initial roles
        let key = DataKey::Role(ADMIN_ROLE, admin);
        e.storage().persistent().set(&key, &true);
    }

    pub fn pause(e: Env, admin: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin.clone()) && !Self::has_role(&e, PAUSER_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage().instance().set(&DataKey::Paused, &true);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "paused"), admin),
            (),
        );
    }

    pub fn unpause(e: Env, admin: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin.clone()) && !Self::has_role(&e, PAUSER_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage().instance().set(&DataKey::Paused, &false);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "unpaused"), admin),
            (),
        );
    }

    pub fn update_wasm_hash(e: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage()
            .instance()
            .set(&DataKey::EventWasmHash, &new_wasm_hash);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "wasm_hash_updated"), admin),
            new_wasm_hash,
        );
    }

    pub fn create_event(
        e: Env,
        organizer: Address,
        name: String,
        symbol: String,
        uri: String,
        start_time: u64,
        refund_cutoff_time: u64,
    ) -> Address {
        organizer.require_auth();

        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("factory is paused");
        }

        let wasm_hash: BytesN<32> = e.storage().instance().get(&DataKey::EventWasmHash).unwrap();

        let counter: u32 = e
            .storage()
            .instance()
            .get(&symbol_short!("nonce"))
            .unwrap_or(0);
        let next_nonce = counter.checked_add(1).expect("Nonce overflow");
        e.storage()
            .instance()
            .set(&symbol_short!("nonce"), &next_nonce);

        let mut salt_bytes = [0u8; 32];
        let counter_bytes = counter.to_be_bytes();
        salt_bytes[28..32].copy_from_slice(&counter_bytes);
        let salt = BytesN::from_array(&e, &salt_bytes);

        // SDK v23.5.2 uses deploy_v2
        let event_contract_id = e
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, ());

        // Max length for symbol_short is 9, initialize is 10.
        // Use soroban_sdk::Symbol::new(&e, "initialize")
        match e.try_invoke_contract::<()>(
            &event_contract_id,
            &soroban_sdk::Symbol::new(&e, "initialize"),
            vec![
                &e,
                organizer.to_val(),
                name.into_val(&e),
                symbol.into_val(&e),
                uri.into_val(&e),
                start_time.into_val(&e),
                refund_cutoff_time.into_val(&e),
            ],
        ) {
            Ok(Ok(())) => {
                e.events().publish((symbol_short!("contract_init_success"), event_contract_id.clone()), true);
            },
            _ => {
                e.events().publish((symbol_short!("contract_init_failed"), event_contract_id.clone()), true);
                panic!("failed to initialize event contract");
            }
        }

        let key = DataKey::OrganizerEvents(organizer.clone());
        let mut events: Vec<Address> = e
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&e));

        events.push_back(event_contract_id.clone());
        e.storage().persistent().set(&key, &events);

        // Emit an event (using soroban events)
        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("created"), organizer),
            event_contract_id.clone(),
        );

        event_contract_id
    }

    pub fn get_events_by_organizer(e: Env, organizer: Address) -> Vec<Address> {
        let key = DataKey::OrganizerEvents(organizer);
        e.storage().persistent().get(&key).unwrap_or(Vec::new(&e))
    }

    pub fn transfer_event_ownership(e: Env, event: Address, from: Address, to: Address) {
        from.require_auth();

        let from_key = DataKey::OrganizerEvents(from.clone());
        let from_events: Vec<Address> = e
            .storage()
            .persistent()
            .get(&from_key)
            .unwrap_or(Vec::new(&e));

        let mut new_from_events = Vec::new(&e);
        let mut found = false;
        for existing_event in from_events.clone().into_iter() {
            if existing_event != event {
                new_from_events.push_back(existing_event);
            } else {
                found = true;
            }
        }

        if !found {
            panic!("event not owned by 'from' address");
        }

        e.storage().persistent().set(&from_key, &new_from_events);

        let to_key = DataKey::OrganizerEvents(to.clone());
        let mut to_events: Vec<Address> = e
            .storage()
            .persistent()
            .get(&to_key)
            .unwrap_or(Vec::new(&e));
        to_events.push_back(event.clone());
        e.storage().persistent().set(&to_key, &to_events);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("transfer"), event), (from, to));
    }

    // --- UPGRADEABILITY MECHANISMS ---
    // Schedule an upgrade with a timelock (e.g., 24 hours).
    pub fn schedule_upgrade(e: Env, admin: Address, new_wasm_hash: BytesN<32>, unlock_time: u64) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        if e.ledger().timestamp() >= unlock_time {
            panic!("unlock_time must be in the future");
        }

        e.storage().instance().set(
            &DataKey::UpgradeTimelock,
            &(new_wasm_hash.clone(), unlock_time),
        );

        e.events().publish(
            (Symbol::new(&e, "UpgradeScheduled"),),
            (new_wasm_hash, unlock_time),
        );
    }

    // Cancel a scheduled upgrade. (Rollback mechanism before execution)
    pub fn cancel_upgrade(e: Env, admin: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        e.storage().instance().remove(&DataKey::UpgradeTimelock);
        e.events()
            .publish((Symbol::new(&e, "UpgradeCancelled"),), ());
    }

    // Execute the scheduled upgrade.
    pub fn execute_upgrade(e: Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let (scheduled_hash, unlock_time): (BytesN<32>, u64) = e
            .storage()
            .instance()
            .get(&DataKey::UpgradeTimelock)
            .unwrap_or_else(|| panic!("no upgrade scheduled"));

        if scheduled_hash != new_wasm_hash {
            panic!("wasm hash does not match scheduled");
        }
        if e.ledger().timestamp() < unlock_time {
            panic!("timelock not expired");
        }

        // Clear the timelock so it can't be reused
        e.storage().instance().remove(&DataKey::UpgradeTimelock);

        // Perform the upgrade
        e.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        e.events()
            .publish((Symbol::new(&e, "Upgraded"),), new_wasm_hash);
    }

    // Execute a state migration after an upgrade.
    pub fn migrate_state(e: Env, admin: Address, new_version: u32) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let current_version: u32 = e.storage().instance().get(&DataKey::Version).unwrap_or(1);
        if new_version <= current_version {
            panic!("new_version must be > current_version");
        }

        // State migration logic goes here...

        e.storage().instance().set(&DataKey::Version, &new_version);
        e.events().publish(
            (Symbol::new(&e, "StateMigrated"),),
            (current_version, new_version),
        );
    }

    // Get current contract version
    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // --- ROLE MANAGEMENT ---
    pub fn grant_role(e: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let key = DataKey::Role(role, address);
        e.storage().persistent().set(&key, &true);
    }

    pub fn revoke_role(e: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let key = DataKey::Role(role, address);
        e.storage().persistent().remove(&key);
    }

    pub fn has_role(e: &Env, role: Symbol, address: Address) -> bool {
        let key = DataKey::Role(role, address);
        e.storage().persistent().has(&key)
    }
}
