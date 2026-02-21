#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Bytes, Env, String, Symbol, Vec};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

mod storage_types;
use storage_types::{
    AllocationConfig, AllocationStrategyType, AntiSnipingConfig, DataKey, EventInfo, PricingConfig,
    PricingStrategy, Ticket, Tier, VRFState,
};

mod oracle;
use oracle::{fetch_price_with_fallback, oracle_price_to_multiplier, DEFAULT_STALENESS_SECONDS};

mod vrf;
use vrf::{RandomnessOutput, VRFEngine, VRFProof};

mod commitment;
use commitment::{Commitment, CommitmentScheme, Reveal};

mod allocation;
use allocation::{
    AllocationEngine, AllocationResult, AntiSnipingConfig as AllocAntiSnipingConfig, LotteryEntry,
};

mod entropy;
use entropy::{EntropyManager, EntropySource, EntropyState};

// Dynamic pricing constants
const PRICE_INCREASE_BPS: i128 = 500; // 5% increase per tier threshold
const EARLY_BIRD_DISCOUNT_BPS: i128 = 1000; // 10% discount max
const ORACLE_PRECISION: i128 = 10000; // Assuming oracle returns multiplier in bps (e.g. 10000 = 1x)

#[contract]
pub struct SoulboundTicketContract;

#[contractimpl]
impl SoulboundTicketContract {
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

        // Init default PricingConfig (placeholder addresses, standard bounds)
        let default_config = PricingConfig {
            oracle_address: admin.clone(), // Update via set_pricing_config after deployment
            dex_pool_address: admin.clone(), // Update via set_pricing_config after deployment
            price_floor: 0,
            price_ceiling: i128::MAX,
            update_frequency: 3600,
            last_update_time: e.ledger().timestamp(),
            is_frozen: false,
            oracle_pair: String::from_str(e, "XLM/USD"),
            oracle_reference_price: oracle::DIA_ORACLE_DECIMALS, // $1.00 baseline (1.0 * 10^8)
            max_oracle_age_seconds: DEFAULT_STALENESS_SECONDS,
        };
        e.storage()
            .instance()
            .set(&DataKey::PricingConfig, &default_config);

        // Init Token Metadata via OpenZeppelin Base
        Base::set_metadata(e, uri, name, symbol);
        ownable::set_owner(e, &admin);
    }

    // Set Pricing Config
    pub fn set_pricing_config(e: &Env, config: PricingConfig) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::PricingConfig, &config);
    }

    /// Admin-only: manually update the oracle reference price used to compute
    /// multipliers.  Call this once after deployment pointing at a real oracle,
    /// or whenever you want to re-baseline the reference price.
    pub fn update_oracle_reference(e: &Env, new_reference_price: i128) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.oracle_reference_price = new_reference_price;
        e.storage().instance().set(&DataKey::PricingConfig, &config);
    }

    // Emergency freeze toggle
    pub fn emergency_freeze(e: &Env, freeze: bool) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.is_frozen = freeze;
        e.storage().instance().set(&DataKey::PricingConfig, &config);
    }

    // Add a new ticket tier
    pub fn add_tier(
        e: &Env,
        tier_symbol: Symbol,
        name: String,
        base_price: i128,
        max_supply: u32,
        strategy: PricingStrategy,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Tier(tier_symbol.clone());
        if e.storage().persistent().has(&key) {
            panic!("Tier already exists");
        }

        let tier = Tier {
            name,
            base_price,
            current_price: base_price,
            max_supply,
            minted: 0,
            active: true,
            strategy,
        };

        e.storage().persistent().set(&key, &tier);
    }

    /// Fetch the current external price multiplier using the real DIA oracle.
    ///
    /// Strategy:
    ///  1. Call `DiaOraclePriceClient::try_get_value(pair)` on the configured oracle.
    ///  2. Verify that the returned timestamp is within `max_oracle_age_seconds`.
    ///  3. If the oracle is stale or the cross-contract call fails, fall back to
    ///     `DexPriceRouterClient::try_get_spot_price(pair)` on the DEX address.
    ///  4. If both fail, return `ORACLE_PRECISION` (neutral — no adjustment).
    ///
    /// The raw price (8 decimals, $1.00 == 100_000_000) is converted into a
    /// `ORACLE_PRECISION`-scaled multiplier using the stored `oracle_reference_price`.
    fn fetch_oracle_multiplier(e: &Env, config: &PricingConfig) -> i128 {
        match fetch_price_with_fallback(
            e,
            &config.oracle_address,
            &config.dex_pool_address,
            config.oracle_pair.clone(),
            config.max_oracle_age_seconds,
        ) {
            Some(result) => oracle_price_to_multiplier(
                result.price,
                config.oracle_reference_price,
                ORACLE_PRECISION,
            ),
            // Both oracle and DEX unavailable: apply neutral multiplier (no adjustment)
            None => ORACLE_PRECISION,
        }
    }

    // Dynamic pricing query
    pub fn get_ticket_price(e: &Env, tier_symbol: Symbol) -> i128 {
        let config: PricingConfig = e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        let key = DataKey::Tier(tier_symbol);
        let tier: Tier = e.storage().persistent().get(&key).unwrap();

        if config.is_frozen {
            return tier.current_price;
        }

        // Base price
        let mut price = tier.base_price;

        // Apply strategy variations
        match tier.strategy {
            PricingStrategy::Standard => {
                // Demand based: base_price * (1 + (minted / (max_supply / 5)) * 5%)
                let thresholds_passed = tier.minted / (tier.max_supply.max(1) / 5).max(1);
                let increase = price * PRICE_INCREASE_BPS * (thresholds_passed as i128) / 10000;
                price += increase;
            }
            PricingStrategy::TimeDecay => {
                let event_info: EventInfo =
                    e.storage().instance().get(&DataKey::EventInfo).unwrap();
                let now = e.ledger().timestamp();
                // If purchased way before event, apply 10% discount
                // Assume linear scale from start to event_start_time
                let start = event_info.start_time.saturating_sub(604800); // 1 week before
                if now < start {
                    price -= price * EARLY_BIRD_DISCOUNT_BPS / 10000;
                }
            }
            PricingStrategy::AbTestA => {
                // High demand sensitivity (10% increase per threshold)
                let thresholds_passed = tier.minted / (tier.max_supply.max(1) / 5).max(1);
                let increase =
                    price * (PRICE_INCREASE_BPS * 2) * (thresholds_passed as i128) / 10000;
                price += increase;
            }
            PricingStrategy::AbTestB => {
                // Floor starts higher (+20%)
                price += price * 2000 / 10000;
            }
        }

        // Apply external Oracle factors using the real DIA oracle integration
        let oracle_multiplier = Self::fetch_oracle_multiplier(e, &config);
        price = price * oracle_multiplier / ORACLE_PRECISION;

        // Apply bounds
        price = price.max(config.price_floor).min(config.price_ceiling);

        // We only return the price here. It is updated during `purchase`.
        price
    }

    // Batch Minting for Organizer
    pub fn batch_mint(e: &Env, to: Address, tier_symbol: Symbol, amount: u32) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Tier(tier_symbol.clone());
        let mut tier: Tier = e
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Tier not found"));

        if tier.minted + amount > tier.max_supply {
            panic!("Exceeds tier max supply");
        }

        for _ in 0..amount {
            // custom sequential increment
            let mut counter: u32 = e
                .storage()
                .instance()
                .get(&DataKey::TokenIdCounter)
                .unwrap();
            counter += 1;
            let token_id = counter;
            e.storage()
                .instance()
                .set(&DataKey::TokenIdCounter, &counter);

            Base::sequential_mint(e, &to);

            let ticket = Ticket {
                tier_symbol: tier_symbol.clone(),
                purchase_time: e.ledger().timestamp(),
                price_paid: 0, // Admin mints are free
                is_valid: true,
            };
            e.storage()
                .persistent()
                .set(&DataKey::Ticket(token_id), &ticket);
        }

        tier.minted += amount;
        e.storage().persistent().set(&key, &tier);
    }

    // Purchase a ticket
    pub fn purchase(e: &Env, buyer: Address, payment_token: Address, tier_symbol: Symbol) {
        buyer.require_auth();

        let key = DataKey::Tier(tier_symbol.clone());
        let mut tier: Tier = e
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Tier not found"));

        if !tier.active {
            panic!("Tier is not active");
        }
        if tier.minted >= tier.max_supply {
            panic!("Tier sold out");
        }

        let price = Self::get_ticket_price(e, tier_symbol.clone());

        // Process payment
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        let token_client = token::Client::new(e, &payment_token);
        token_client.transfer(&buyer, &admin, &price);

        // Mint Token
        let mut counter: u32 = e
            .storage()
            .instance()
            .get(&DataKey::TokenIdCounter)
            .unwrap();
        counter += 1;
        let token_id = counter;
        e.storage()
            .instance()
            .set(&DataKey::TokenIdCounter, &counter);

        Base::sequential_mint(e, &buyer);

        let ticket = Ticket {
            tier_symbol: tier_symbol.clone(),
            purchase_time: e.ledger().timestamp(),
            price_paid: price,
            is_valid: true,
        };
        e.storage()
            .persistent()
            .set(&DataKey::Ticket(token_id), &ticket);

        tier.minted += 1;
        tier.current_price = price; // Update the current recorded price for this tier
        e.storage().persistent().set(&key, &tier);

        // Update pricing config last update time
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.last_update_time = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::PricingConfig, &config);
    }

    // Refund a ticket
    pub fn refund(e: &Env, owner: Address, payment_token: Address, token_id: u32) {
        owner.require_auth();

        let current_owner = Self::owner_of(e, token_id);
        if owner != current_owner {
            panic!("Not the ticket owner");
        }

        let event_info: EventInfo = e.storage().instance().get(&DataKey::EventInfo).unwrap();
        if e.ledger().timestamp() > event_info.refund_cutoff_time {
            panic!("Refund window closed");
        }

        let mut ticket: Ticket = e
            .storage()
            .persistent()
            .get(&DataKey::Ticket(token_id))
            .unwrap();
        if !ticket.is_valid {
            panic!("Ticket already invalidated");
        }

        // Process refund
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        let token_client = token::Client::new(e, &payment_token);
        token_client.transfer(&admin, &owner, &ticket.price_paid);

        // Invalidate and Burn
        ticket.is_valid = false;
        e.storage()
            .persistent()
            .set(&DataKey::Ticket(token_id), &ticket);
        Base::burn(e, &owner, token_id);
    }

    // Ticket Validation
    pub fn validate_ticket(e: &Env, token_id: u32) -> bool {
        let key = DataKey::Ticket(token_id);
        if !e.storage().persistent().has(&key) {
            return false;
        }
        let ticket: Ticket = e.storage().persistent().get(&key).unwrap();
        ticket.is_valid
    }

    // View functions logic
    pub fn get_ticket(e: &Env, token_id: u32) -> Ticket {
        e.storage()
            .persistent()
            .get(&DataKey::Ticket(token_id))
            .unwrap()
    }
}

// Implement SEP-0054 via OpenZeppelin Interface
#[contractimpl]
impl NonFungibleToken for SoulboundTicketContract {
    type ContractType = Base;

    fn balance(e: &Env, owner: Address) -> u32 {
        Self::ContractType::balance(e, &owner)
    }

    fn owner_of(e: &Env, token_id: u32) -> Address {
        Self::ContractType::owner_of(e, token_id)
    }

    // Soulbound restrictions overrides
    fn transfer(_e: &Env, _from: Address, _to: Address, _token_id: u32) {
        panic!("Soulbound: Tickets cannot be transferred");
    }

    fn transfer_from(_e: &Env, _spender: Address, _from: Address, _to: Address, _token_id: u32) {
        panic!("Soulbound: Tickets cannot be transferred");
    }

    fn approve(
        _e: &Env,
        _approver: Address,
        _approved: Address,
        _token_id: u32,
        _live_until_ledger: u32,
    ) {
        panic!("Soulbound: Approval disabled for non-transferable tokens");
    }

    fn approve_for_all(_e: &Env, _owner: Address, _operator: Address, _live_until_ledger: u32) {
        panic!("Soulbound: Approval disabled for non-transferable tokens");
    }

    fn get_approved(_e: &Env, _token_id: u32) -> Option<Address> {
        None
    }

    fn is_approved_for_all(_e: &Env, _owner: Address, _operator: Address) -> bool {
        false
    }

    // Metadata
    fn name(e: &Env) -> String {
        Self::ContractType::name(e)
    }

    fn symbol(e: &Env) -> String {
        Self::ContractType::symbol(e)
    }

    fn token_uri(e: &Env, token_id: u32) -> String {
        Self::ContractType::token_uri(e, token_id)
    }
}

// Ownable Utils
#[contractimpl]
impl Ownable for SoulboundTicketContract {
    fn get_owner(e: &Env) -> Option<Address> {
        ownable::get_owner(e)
    }

    fn transfer_ownership(e: &Env, new_owner: Address, live_until_ledger: u32) {
        ownable::transfer_ownership(e, &new_owner, live_until_ledger);
    }

    fn accept_ownership(e: &Env) {
        ownable::accept_ownership(e);
    }

    fn renounce_ownership(e: &Env) {
        ownable::renounce_ownership(e);
    }
}
