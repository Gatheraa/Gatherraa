#![no_std]

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, Bytes, BytesN, Env, String, Symbol, Vec,
};
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

mod proxy;
mod pricing_engine;
mod allocation_engine;
mod upgrade_manager;
mod core;

// Dynamic pricing constants
const PRICE_INCREASE_BPS: i128 = 500; // 5% increase per tier threshold
const EARLY_BIRD_DISCOUNT_BPS: i128 = 1000; // 10% discount max
const ORACLE_PRECISION: i128 = 10000; // Assuming oracle returns multiplier in bps (e.g. 10000 = 1x)

#[contract]
pub struct SoulboundTicketContract;

const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const MOD_ROLE: Symbol = symbol_short!("MOD");

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

        // Init Version
        e.storage().instance().set(&DataKey::Version, &1u32);

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

        // Grant initial roles
        let key = DataKey::Role(ADMIN_ROLE, admin.clone());
        e.storage().persistent().set(&key, &true);

        // Init Token Metadata via OpenZeppelin Base
        Base::set_metadata(e, uri.clone(), name.clone(), symbol.clone());
        ownable::set_owner(e, &admin);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "initialized"), admin),
            (name, symbol, uri, start_time, refund_cutoff_time),
        );
    }

    // Set Pricing Config
    pub fn set_pricing_config(e: &Env, admin: Address, config: PricingConfig) {
        admin.require_auth();
        e.storage().instance().set(&DataKey::PricingConfig, &config.clone());

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "pricing_config_updated"), admin),
            config,
        );
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage().instance().set(&DataKey::PricingConfig, &config);
    }

    /// ==================== VRF & LOTTERY FUNCTIONS ====================

    /// Set the public key for verifying off-chain VRF proofs
    pub fn set_vrf_public_key(e: &Env, public_key: BytesN<32>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::VRFPublicKey, &public_key.clone());

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "vrf_pub_key_updated"), admin),
            public_key,
        );
    }

    /// Add an authorized entropy provider
    pub fn add_entropy_provider(e: &Env, provider: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::EntropyProvider(provider.clone()), &true);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "entropy_provider_added"), admin),
            provider,
        );
    }

    /// Submit an entropy seed for a specific tier
    pub fn submit_entropy_seed(e: &Env, provider: Address, tier_symbol: Symbol, seed: Bytes) {
        provider.require_auth();
        
        if !e.storage().instance().has(&DataKey::EntropyProvider(provider.clone())) {
            panic!("Not an authorized entropy provider");
        }

        e.storage().persistent().set(&DataKey::EntropySeed(provider.clone(), tier_symbol.clone()), &seed);
        
        let mut providers: Vec<Address> = e.storage().persistent().get(&DataKey::EntropyProviders(tier_symbol.clone())).unwrap_or(Vec::new(e));
        if !providers.contains(&provider) {
            providers.push_back(provider.clone()).unwrap();
            e.storage().persistent().set(&DataKey::EntropyProviders(tier_symbol.clone()), &providers);
        }

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "entropy_seed_submitted"), provider),
            tier_symbol,
        );
    }

    /// Submit an Ed25519 VRF proof (signature) for a tier
    pub fn submit_vrf_proof(e: &Env, tier_symbol: Symbol, seed: Bytes, signature: BytesN<64>) {
        // VRF proofs are typically submitted by a trusted off-chain node (e.g., Chainlink-like)
        // No specific auth here yet, but it must verify against the registered VRF public key.
        let public_key: BytesN<32> = e.storage().instance().get(&DataKey::VRFPublicKey).unwrap_or_else(|| panic!("VRF public key not set"));
        
        if VRFEngine::verify_signature_vrf(e, &public_key, &seed, &signature) {
            // We store the signature as the proof of randomness. 
            // The actual entropy used will be the hash of this signature.
            e.storage().persistent().set(&DataKey::VRFProof(tier_symbol.clone()), &signature.clone());

            // Emit event
            e.events().publish(
                (Symbol::new(&e, "vrf_proof_submitted"), tier_symbol),
                signature,
            );
        } else {
            panic!("Invalid VRF proof: verification failed against registered public key");
        }
    }

    /// Initialize VRF lottery system for a tier
    /// Sets up commitment scheme and allocation strategy
    pub fn initialize_lottery(
        e: &Env,
        admin: Address,
        tier_symbol: Symbol,
        strategy_type: AllocationStrategyType,
        total_allocations: u32,
        finalization_ledger: u32,
        reveal_start_ledger: u32,
        reveal_end_ledger: u32,
    ) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        // Validate tier exists
        let key = DataKey::Tier(tier_symbol.clone());
        if !e.storage().persistent().has(&key) {
            panic!("Tier not found");
        }

        // Validate ledger timeline
        if finalization_ledger < e.ledger().sequence() {
            panic!("Finalization ledger must be in the future");
        }

        if reveal_start_ledger >= reveal_end_ledger {
            panic!("Reveal timeline invalid");
        }

        let config = AllocationConfig {
            strategy: strategy_type,
            total_allocations,
            allocated_count: 0,
            allocation_complete: false,
            finalization_ledger,
            reveal_start_ledger,
            reveal_end_ledger,
        };

        e.storage()
            .persistent()
            .set(&DataKey::AllocationState(tier_symbol.clone()), &config);

        // Initialize anti-sniping config
        let anti_sniping = AllocAntiSnipingConfig {
            minimum_lock_period: 10,
            max_entries_per_address: 5,
            rate_limit_window: 3600,
            randomization_delay_ledgers: 3,
        };

        e.storage()
            .persistent()
            .set(&DataKey::AntiSnipingConfig(tier_symbol.clone()), &anti_sniping);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "lottery_initialized"), admin),
            (tier_symbol, strategy_type, total_allocations, finalization_ledger),
        );
    }

    /// Register as participant in lottery
    pub fn register_lottery_entry(
        e: &Env,
        participant: Address,
        tier_symbol: Symbol,
        commitment_hash: Option<Bytes>,
    ) {
        participant.require_auth();

        // Check anti-sniping
        let anti_sniping_key = DataKey::AntiSnipingConfig(tier_symbol.clone());
        if let Some(anti_sniping) = e
            .storage()
            .persistent()
            .get::<_, AllocAntiSnipingConfig>(&anti_sniping_key)
        {
            let mut recent_entries: Vec<LotteryEntry> = Vec::new(e);
            let count_key = DataKey::LotteryEntryCount(tier_symbol.clone());
            let entry_count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);

            for i in 0..entry_count.min(10) {
                if let Some(entry) = e
                    .storage()
                    .persistent()
                    .get::<_, LotteryEntry>(&DataKey::LotteryEntry(tier_symbol.clone(), i))
                {
                    recent_entries.push_back(entry).unwrap();
                }
            }

            if !AllocationEngine::check_anti_sniping(
                e,
                &participant,
                &anti_sniping,
                &recent_entries,
            ) {
                panic!("Rate limit exceeded for this participant");
            }
        }

        // Create lottery entry
        let entry = LotteryEntry {
            participant: participant.clone(),
            entry_time: e.ledger().timestamp(),
            nonce: e.ledger().sequence(),
            commitment_hash,
        };

        // Store entry
        let count_key = DataKey::LotteryEntryCount(tier_symbol.clone());
        let mut count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
        e.storage()
            .persistent()
            .set(&DataKey::LotteryEntry(tier_symbol.clone(), count), &entry);
        e.storage()
            .persistent()
            .set(&count_key, count.saturating_add(1));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "lottery_entry_registered"), participant),
            tier_symbol,
        );
    }

    /// Generate batch randomness for lottery finalization
    pub fn generate_lottery_randomness(
        e: &Env,
        admin: Address,
        tier_symbol: Symbol,
        batch_size: u32,
    ) -> Vec<RandomnessOutput> {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        // Verify allocation state exists
        let state_key = DataKey::AllocationState(tier_symbol.clone());
        let state: AllocationConfig = e
            .storage()
            .persistent()
            .get(&state_key)
            .unwrap_or_else(|| panic!("Allocation not initialized"));

        // Check if we're at finalization ledger
        if e.ledger().sequence() < state.finalization_ledger {
            panic!("Cannot finalize before finalization ledger");
        }

        // Collect entropy from all sources
        let mut entropy_sources = Vec::new(e);
        
        // 1. Multi-provider seeds
        let providers: Vec<Address> = e.storage().persistent().get(&DataKey::EntropyProviders(tier_symbol.clone())).unwrap_or(Vec::new(e));
        for provider in providers {
            if let Some(seed) = e.storage().persistent().get::<_, Bytes>(&DataKey::EntropySeed(provider, tier_symbol.clone())) {
                entropy_sources.push_back(seed).unwrap();
            }
        }

        // 2. VRF Proof (if exists, mix it in)
        if let Some(proof) = e.storage().persistent().get::<_, BytesN<64>>(&DataKey::VRFProof(tier_symbol.clone())) {
            let mut proof_bytes = Vec::new(e);
            proof_bytes.extend_from_array(&proof.to_array()).unwrap();
            entropy_sources.push_back(Bytes::from_vec(&proof_bytes)).unwrap();
        }

        // Mix all sources to get the final master entropy
        let mixed_entropy = VRFEngine::mix_entropy_sources(e, entropy_sources);

        // Generate batch randomness using the mixed entropy
        let randomness_outputs = VRFEngine::generate_batch_randomness(e, batch_size, mixed_entropy);

        // Validate randomness quality
        if !VRFEngine::validate_randomness_quality(e, &randomness_outputs) {
            panic!("Generated randomness failed quality validation");
        }

        // Store randomness hash for verification
        let randomness_hash = VRFEngine::hash_randomness_batch(e, &randomness_outputs);
        let vrf_state = VRFState {
            randomness_generated: true,
            randomness_hash,
            batch_nonce: 0,
            finalization_ledger: state.finalization_ledger,
        };

        e.storage().persistent().set(&DataKey::VRFState, &vrf_state);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "lottery_randomness_generated"), admin),
            (tier_symbol.clone(), randomness_hash),
        );

        randomness_outputs
    }

    /// Execute lottery allocation based on registered entries and randomness
    pub fn execute_lottery_allocation(
        e: &Env,
        admin: Address,
        tier_symbol: Symbol,
        randomness_values: Vec<u128>,
    ) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        let state_key = DataKey::AllocationState(tier_symbol.clone());
        let mut state: AllocationConfig = e
            .storage()
            .persistent()
            .get(&state_key)
            .unwrap_or_else(|| panic!("Allocation not initialized"));

        // Verify randomness has been generated
        let vrf_state_key = DataKey::VRFState;
        let vrf_state: VRFState = e
            .storage()
            .persistent()
            .get(&vrf_state_key)
            .unwrap_or_else(|| panic!("Randomness not generated"));

        if !vrf_state.randomness_generated {
            panic!("Randomness not ready");
        }

        // Load entries
        let count_key = DataKey::LotteryEntryCount(tier_symbol.clone());
        let entry_count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
        let mut entries: Vec<LotteryEntry> = Vec::new(e);

        for i in 0..entry_count {
            if let Some(entry) = e
                .storage()
                .persistent()
                .get::<_, LotteryEntry>(&DataKey::LotteryEntry(tier_symbol.clone(), i))
            {
                entries.push_back(entry).unwrap();
            }
        }

        // Execute allocation based on strategy
        let results: Vec<AllocationResult> = match state.strategy {
            AllocationStrategyType::FCFS => {
                AllocationEngine::allocate_fcfs(e, &entries, state.total_allocations)
            }
            AllocationStrategyType::Lottery => AllocationEngine::allocate_lottery(
                e,
                &entries,
                &randomness_values,
                state.total_allocations,
            ),
            AllocationStrategyType::TimeWeighted => AllocationEngine::allocate_time_weighted(
                e,
                &entries,
                &randomness_values,
                state.total_allocations,
            ),
            _ => {
                panic!("Strategy not yet implemented");
            }
        };

        // Store results
        e.storage()
            .persistent()
            .set(&DataKey::LotteryResults(tier_symbol.clone()), &results);

        // Update state
        state.allocated_count = (results.len() as u32).min(state.total_allocations);
        state.allocation_complete = true;
        e.storage().persistent().set(&state_key, &state);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "lottery_allocation_executed"), admin),
            (tier_symbol, state.allocated_count),
        );
    }

    /// Verify a randomness proof
    pub fn verify_lottery_randomness(
        e: &Env,
        proof: &VRFProof,
        original_input: Bytes,
        expected_ledger: u32,
    ) -> bool {
        VRFEngine::verify_vrf_proof(e, proof, original_input, expected_ledger)
    }

    /// Get lottery results transparency
    pub fn get_lottery_winners(e: &Env, tier_symbol: Symbol) -> Vec<AllocationResult> {
        e.storage()
            .persistent()
            .get(&DataKey::LotteryResults(tier_symbol.clone()))
            .unwrap_or_else(|| Vec::new(e))
    }

    /// Get allocation fairness score (0-100)
    pub fn get_allocation_fairness(e: &Env, tier_symbol: Symbol) -> u32 {
        let count_key = DataKey::LotteryEntryCount(tier_symbol.clone());
        let entry_count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);

        if let Some(results) = e
            .storage()
            .persistent()
            .get::<_, Vec<AllocationResult>>(&DataKey::LotteryResults(tier_symbol))
        {
            AllocationEngine::compute_fairness_score(e, &results, entry_count)
        } else {
            0
        }
    }

    /// ==================== PRICING FUNCTIONS ====================

    /// multipliers.  Call this once after deployment pointing at a real oracle,
    /// or whenever you want to re-baseline the reference price.
    pub fn update_oracle_reference(e: &Env, admin: Address, new_reference_price: i128) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.oracle_reference_price = new_reference_price;
        e.storage().instance().set(&DataKey::PricingConfig, &config);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "oracle_ref_updated"), admin),
            new_reference_price,
        );
    }

    // Emergency freeze toggle
    pub fn emergency_freeze(e: &Env, admin: Address, freeze: bool) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.is_frozen = freeze;
        e.storage().instance().set(&DataKey::PricingConfig, &config);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "emergency_freeze"), admin),
            freeze,
        );
    }

    // Add a new ticket tier
    pub fn add_tier(
        e: &Env,
        admin: Address,
        tier_symbol: Symbol,
        name: String,
        base_price: i128,
        max_supply: u32,
        strategy: PricingStrategy,
    ) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

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

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "tier_added"), admin),
            (tier_symbol, base_price, max_supply),
        );
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
                let multiplier = (thresholds_passed as i128).checked_mul(PRICE_INCREASE_BPS).expect("Arithmetic overflow");
                let increase = price.checked_mul(multiplier).and_then(|v| v.checked_div(10000)).expect("Arithmetic overflow");
                price = price.checked_add(increase).expect("Arithmetic overflow");
            }
            PricingStrategy::TimeDecay => {
                let event_info: EventInfo =
                    e.storage().instance().get(&DataKey::EventInfo).unwrap();
                let now = e.ledger().timestamp();
                // If purchased way before event, apply 10% discount
                // Assume linear scale from start to event_start_time
                let start = event_info.start_time.saturating_sub(604800); // 1 week before
                if now < start {
                    let discount = price.checked_mul(EARLY_BIRD_DISCOUNT_BPS).and_then(|v| v.checked_div(10000)).expect("Arithmetic overflow");
                    price = price.checked_sub(discount).expect("Arithmetic overflow");
                }
            }
            PricingStrategy::AbTestA => {
                // High demand sensitivity (10% increase per threshold)
                let thresholds_passed = tier.minted / (tier.max_supply.max(1) / 5).max(1);
                let multiplier = (thresholds_passed as i128).checked_mul(PRICE_INCREASE_BPS * 2).expect("Arithmetic overflow");
                let increase = price.checked_mul(multiplier).and_then(|v| v.checked_div(10000)).expect("Arithmetic overflow");
                price = price.checked_add(increase).expect("Arithmetic overflow");
            }
            PricingStrategy::AbTestB => {
                // Floor starts higher (+20%)
                let uplift = price.checked_mul(2000).and_then(|v| v.checked_div(10000)).expect("Arithmetic overflow");
                price = price.checked_add(uplift).expect("Arithmetic overflow");
            }
        }

        // Apply external Oracle factors using the real DIA oracle integration
        let oracle_multiplier = Self::fetch_oracle_multiplier(e, &config);
        price = price.checked_mul(oracle_multiplier).and_then(|v| v.checked_div(ORACLE_PRECISION)).expect("Arithmetic overflow");

        // Apply bounds
        price = price.max(config.price_floor).min(config.price_ceiling);

        // We only return the price here. It is updated during `purchase`.
        price
    }

    // Batch Minting for Organizer
    pub fn batch_mint(e: &Env, admin: Address, to: Address, tier_symbol: Symbol, amount: u32) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

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
            counter = counter.checked_add(1).expect("Counter overflow");
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

        tier.minted = tier.minted.checked_add(amount).expect("Supply overflow");
        e.storage().persistent().set(&key, &tier);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "batch_minted"), admin),
            (to, tier_symbol, amount),
        );
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
        counter = counter.checked_add(1).expect("Counter overflow");
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

        tier.minted = tier.minted.checked_add(1).expect("Supply overflow");
        tier.current_price = price; // Update the current recorded price for this tier
        e.storage().persistent().set(&key, &tier);

        // Update pricing config last update time
        let mut config: PricingConfig =
            e.storage().instance().get(&DataKey::PricingConfig).unwrap();
        config.last_update_time = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::PricingConfig, &config);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "ticket_purchased"), buyer),
            (tier_symbol, token_id, price),
        );
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

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "ticket_refunded"), owner),
            (token_id, ticket.price_paid),
        );
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

    // --- UPGRADEABILITY MECHANISMS ---
    // Schedule an upgrade with a timelock (e.g., 24 hours).
    pub fn schedule_upgrade(e: &Env, admin: Address, new_wasm_hash: BytesN<32>, unlock_time: u64) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
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
    pub fn cancel_upgrade(e: &Env, admin: Address) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }

        e.storage().instance().remove(&DataKey::UpgradeTimelock);
        e.events()
            .publish((Symbol::new(&e, "UpgradeCancelled"),), ());
    }

    // Execute the scheduled upgrade.
    pub fn execute_upgrade(e: &Env, admin: Address, new_wasm_hash: BytesN<32>) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
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
    pub fn migrate_state(e: &Env, admin: Address, new_version: u32) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
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
    pub fn version(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // --- ROLE MANAGEMENT ---
    pub fn grant_role(e: &Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let key = DataKey::Role(role, address);
        e.storage().persistent().set(&key, &true);
    }

    pub fn revoke_role(e: &Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(e, ADMIN_ROLE, admin) {
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
