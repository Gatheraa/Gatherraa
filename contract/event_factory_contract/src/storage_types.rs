use soroban_sdk::{contracttype, contracterror, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                    // Address of the factory admin
    EventWasmHash,            // BytesN<32> of the event contract WASM
    Paused,                   // bool indicating if new events can be created
    OrganizerEvents(Address), // Mapping from an organizer Address to Vec<Address> of event contracts
    UpgradeTimelock,
    Version,
    UpgradeTimelock,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EventFactoryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    EventNotFound = 5,
    InvalidWasmHash = 6,
    UpgradeTimelockNotSet = 7,
    UpgradeTimelockNotExpired = 8,
    UpgradeHashMismatch = 9,
    VersionMismatch = 10,
    InvalidUnlockTime = 11,
}
