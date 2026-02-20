#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::DataKey;

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, Address, BytesN, Env, IntoVal, String, Vec,
};

#[contract]
pub struct EventFactoryContract;

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
    }

    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn update_wasm_hash(e: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage()
            .instance()
            .set(&DataKey::EventWasmHash, &new_wasm_hash);
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
        e.storage()
            .instance()
            .set(&symbol_short!("nonce"), &(counter + 1));

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
        e.invoke_contract::<()>(
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
        );

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
}
