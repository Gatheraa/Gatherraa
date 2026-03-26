use soroban_sdk::{
    contract, contractimpl, token, Address, BytesN, Env, String, Symbol, Vec,
};

use crate::storage_types::{DataKey, Ticket, Tier, EventInfo};
use crate::pricing_engine::PricingEngine;
use crate::allocation_engine::AllocationEngine;

/// Minimal core ticket contract
#[contract]
pub struct CoreTicketContract;

#[contractimpl]
impl CoreTicketContract {
    /// Initialize core contract
    pub fn initialize(
        e: &Env,
        admin: Address,
        name: String,
        symbol: String,
        uri: String,
        start_time: u64,
        refund_cutoff_time: u64,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        // Init Event Info
        let event_info = EventInfo {
            start_time,
            refund_cutoff_time,
        };
        e.storage().instance().set(&DataKey::EventInfo, &event_info);
        e.storage().instance().set(&DataKey::Admin, &admin);

        // Init Token Counter
        e.storage().instance().set(&DataKey::TokenIdCounter, &0u32);

        // Init Version
        e.storage().instance().set(&DataKey::Version, &1u32);

        // Initialize minimal token metadata
        e.storage().instance().set(&DataKey::TokenName, &name);
        e.storage().instance().set(&DataKey::TokenSymbol, &symbol);
        e.storage().instance().set(&DataKey::TokenURI, &uri);
    }

    /// Create a new tier with minimal configuration
    pub fn create_tier(
        e: &Env,
        admin: Address,
        tier_id: Symbol,
        name: String,
        max_supply: u32,
        price: i128,
    ) {
        let stored_admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        stored_admin.require_auth();

        let tier = Tier {
            id: tier_id.clone(),
            name,
            max_supply,
            current_supply: 0,
            price,
            active: true,
            created_at: e.ledger().timestamp(),
        };

        e.storage().persistent().set(&DataKey::Tier(tier_id), &tier);
    }

    /// Mint a ticket with simplified logic
    pub fn mint_ticket(
        e: &Env,
        to: Address,
        tier_id: Symbol,
        quantity: u32,
    ) -> Vec<u32> {
        let tier: Tier = e.storage()
            .persistent()
            .get(&DataKey::Tier(tier_id.clone()))
            .unwrap_or_else(|| panic!("tier not found"));

        if !tier.active {
            panic!("tier not active");
        }

        if tier.current_supply + quantity > tier.max_supply {
            panic!("insufficient supply");
        }

        let mut token_ids = Vec::new(e);
        let mut current_counter: u32 = e.storage()
            .instance()
            .get(&DataKey::TokenIdCounter)
            .unwrap();

        for _ in 0..quantity {
            let ticket = Ticket {
                id: current_counter,
                owner: to.clone(),
                tier_id: tier_id.clone(),
                purchased_at: e.ledger().timestamp(),
                refunded: false,
            };

            e.storage()
                .persistent()
                .set(&DataKey::Ticket(current_counter), &ticket);
            token_ids.push_back(current_counter);
            current_counter += 1;
        }

        // Update counter and tier supply
        e.storage()
            .instance()
            .set(&DataKey::TokenIdCounter, &current_counter);

        let mut updated_tier = tier;
        updated_tier.current_supply += quantity;
        e.storage()
            .persistent()
            .set(&DataKey::Tier(tier_id), &updated_tier);

        token_ids
    }

    /// Get ticket information
    pub fn get_ticket(e: &Env, token_id: u32) -> Ticket {
        e.storage()
            .persistent()
            .get(&DataKey::Ticket(token_id))
            .unwrap_or_else(|| panic!("ticket not found"))
    }

    /// Get tier information
    pub fn get_tier(e: &Env, tier_id: Symbol) -> Tier {
        e.storage()
            .persistent()
            .get(&DataKey::Tier(tier_id))
            .unwrap_or_else(|| panic!("tier not found"))
    }

    /// Get contract version
    pub fn version(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&DataKey::Version)
            .unwrap_or(1)
    }

    /// Get contract name
    pub fn name(e: &Env) -> String {
        e.storage()
            .instance()
            .get(&DataKey::TokenName)
            .unwrap_or_else(|| String::from_str(e, "Unknown"))
    }

    /// Get contract symbol
    pub fn symbol(e: &Env) -> String {
        e.storage()
            .instance()
            .get(&DataKey::TokenSymbol)
            .unwrap_or_else(|| String::from_str(e, "UNK"))
    }
}
