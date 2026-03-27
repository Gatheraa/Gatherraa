#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    Bytes, BytesN, Env, String,
};

const TICKET_WASM: &[u8] = include_bytes!("./mock/ticket_contract.wasm");

// Helper function to setup the environment and factory
fn setup_test() -> (Env, Address, Address, BytesN<32>) {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let organizer = Address::generate(&e);

    let wasm_bytes = Bytes::from_slice(&e, TICKET_WASM);
    let wasm_hash = e.deployer().upload_contract_wasm(wasm_bytes);

    // Deploy the factory
    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);

    factory.initialize(&admin, &wasm_hash);

    (e, admin, organizer, wasm_hash)
}

#[test]
fn test_initialize() {
    let (e, admin, _organizer, wasm_hash) = setup_test();
    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);

    factory.initialize(&admin, &wasm_hash);
    // double init should fail
    let res = factory.try_initialize(&admin, &wasm_hash);
    assert!(res.is_err());
}

#[test]
fn test_create_event() {
    let (e, _admin, organizer, wasm_hash) = setup_test();

    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);
    factory.initialize(&_admin, &wasm_hash);

    let name = String::from_str(&e, "Test Event");
    let symbol = String::from_str(&e, "TST");
    let uri = String::from_str(&e, "https://example.com");
    let start_time: u64 = 1000;
    let refund_cutoff_time: u64 = 500;

    let event_id = factory.create_event(
        &organizer,
        &name,
        &symbol,
        &uri,
        &start_time,
        &refund_cutoff_time,
    );

    let events = factory.get_events_by_organizer(&organizer);
    assert_eq!(events.len(), 1);
    assert_eq!(events.get(0).unwrap(), event_id);
}

#[test]
#[should_panic(expected = "factory is paused")]
fn test_pause_unpause() {
    let (e, admin, organizer, wasm_hash) = setup_test();

    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);
    factory.initialize(&admin, &wasm_hash);

    factory.pause();

    let name = String::from_str(&e, "Test Event");
    let symbol = String::from_str(&e, "TST");
    let uri = String::from_str(&e, "https://example.com");

    // This should panic
    factory.create_event(&organizer, &name, &symbol, &uri, &1000, &500);
}

#[test]
fn test_update_wasm_hash() {
    let (e, admin, _organizer, wasm_hash) = setup_test();

    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);
    factory.initialize(&admin, &wasm_hash);

    let new_hash = BytesN::from_array(&e, &[1; 32]);
    factory.update_wasm_hash(&new_hash);
    // Test passes if update successful (no auth error)
}

#[test]
fn test_transfer_ownership() {
    let (e, admin, from_organizer, wasm_hash) = setup_test();
    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);
    factory.initialize(&admin, &wasm_hash);

    let to_organizer = Address::generate(&e);

    let name = String::from_str(&e, "Test Event");
    let symbol = String::from_str(&e, "TST");
    let uri = String::from_str(&e, "https://example.com");

    let event_id = factory.create_event(&from_organizer, &name, &symbol, &uri, &1000, &500);

    let from_events_before = factory.get_events_by_organizer(&from_organizer);
    assert_eq!(from_events_before.len(), 1);

    factory.transfer_event_ownership(&event_id, &from_organizer, &to_organizer);

    let from_events_after = factory.get_events_by_organizer(&from_organizer);
    assert_eq!(from_events_after.len(), 0);

    let to_events_after = factory.get_events_by_organizer(&to_organizer);
    assert_eq!(to_events_after.len(), 1);
    assert_eq!(to_events_after.get(0).unwrap(), event_id);
}

#[test]
fn test_upgrade_flow() {
    let (e, admin, _organizer, wasm_hash) = setup_test();
    let factory_id = e.register(EventFactoryContract, ());
    let factory = EventFactoryContractClient::new(&e, &factory_id);
    factory.initialize(&admin, &wasm_hash);

    // Initial version should be 1
    assert_eq!(factory.version(), 1);

    let new_wasm_hash = wasm_hash;
    let current_timestamp = e.ledger().timestamp();
    let unlock_time = current_timestamp + 86400; // 24 hours later

    // Schedule upgrade
    factory.schedule_upgrade(&new_wasm_hash, &unlock_time);

    // Cancel upgrade (rollback)
    factory.cancel_upgrade();
    // Reschedule
    factory.schedule_upgrade(&new_wasm_hash, &unlock_time);

    // Advance time past unlock_time
    let mut ledger = e.ledger().get();
    ledger.timestamp = unlock_time + 1;
    e.ledger().set(ledger);

    // Migrate state
    factory.migrate_state(&2);
    assert_eq!(factory.version(), 2);

    // Execute upgrade
    factory.execute_upgrade(&new_wasm_hash);
}
