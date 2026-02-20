use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                    // Address of the factory admin
    EventWasmHash,            // BytesN<32> of the event contract WASM
    Paused,                   // bool indicating if new events can be created
    OrganizerEvents(Address), // Mapping from an organizer Address to Vec<Address> of event contracts
}
