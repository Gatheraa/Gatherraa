#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, Auction, Bid, AuctionStatus, AuctionConfig, RateLimiter, 
                   CommitReveal, DutchAuctionError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct DutchAuctionContract;

#[contractimpl]
impl DutchAuctionContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address, config: AuctionConfig) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        // Validate config
        Self::validate_config(&config);

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::AuctionConfig, &config);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        e.storage().instance().set(&DataKey::ActiveAuctions, &Vec::new(&e));
    }

    // Create a new auction
    pub fn create_auction(
        e: Env,
        organizer: Address,
        token: Address,
        ticket_nft: Address,
        initial_price: i128,
        reserve_price: i128,
        floor_price: i128,
        decay_constant: u32,
        start_time: u64,
        duration: u64,
        total_tickets: u32,
        anti_bot_enabled: Option<bool>,
        min_bid_increment: Option<i128>,
    ) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        organizer.require_auth();

        // Validate auction parameters
        Self::validate_auction_params(&e, initial_price, reserve_price, floor_price, decay_constant, duration, total_tickets)?;

        // Check concurrent auction limit
        let config: AuctionConfig = e.storage().instance().get(&DataKey::AuctionConfig).unwrap();
        let active_auctions: Vec<BytesN<32>> = e.storage().instance().get(&DataKey::ActiveAuctions).unwrap();
        if active_auctions.len() >= config.max_concurrent_auctions as usize {
            panic!("concurrent auction limit reached");
        }

        // Generate auction ID
        let auction_id = Self::generate_auction_id(&e, &organizer, &token, initial_price);

        let auction = Auction {
            id: auction_id.clone(),
            organizer: organizer.clone(),
            token: token.clone(),
            ticket_nft: ticket_nft.clone(),
            initial_price,
            reserve_price,
            floor_price,
            decay_constant,
            start_time,
            duration,
            extension_threshold: config.default_extension_threshold,
            extension_duration: config.default_extension_duration,
            current_price: initial_price,
            total_tickets,
            sold_tickets: 0,
            status: AuctionStatus::Pending,
            bids: Vec::new(&e),
            winner_commitments: map![&e],
            final_extension_time: 0,
            anti_bot_enabled: anti_bot_enabled.unwrap_or(config.anti_bot_enabled),
            min_bid_increment: min_bid_increment.unwrap_or(initial_price / 100), // Default 1%
        };

        // Store auction
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        // Add to active auctions
        let mut active = active_auctions;
        active.push_back(auction_id.clone());
        e.storage().instance().set(&DataKey::ActiveAuctions, &active);

        // Add to organizer's auctions
        let organizer_key = DataKey::UserAuctions(organizer.clone());
        let mut organizer_auctions: Vec<BytesN<32>> = e.storage().persistent().get(&organizer_key).unwrap_or(Vec::new(&e));
        organizer_auctions.push_back(auction_id.clone());
        e.storage().persistent().set(&organizer_key, &organizer_auctions);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("auction_created"), auction_id.clone()),
            (organizer, token, initial_price, total_tickets),
        );

        auction_id
    }

    // Start an auction
    pub fn start_auction(e: Env, auction_id: BytesN<32>) {
        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Pending {
            panic!("invalid auction status");
        }

        auction.organizer.require_auth();

        if e.ledger().timestamp() < auction.start_time {
            panic!("auction start time not reached");
        }

        auction.status = AuctionStatus::Active;
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("auction_started"), auction_id.clone()),
            auction.current_price,
        );
    }

    // Commit a bid (for commit-reveal scheme)
    pub fn commit_bid(e: Env, auction_id: BytesN<32>, bidder: Address, commitment: BytesN<32>) {
        bidder.require_auth();

        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Active {
            panic!("auction not active");
        }

        if e.ledger().timestamp() > auction.start_time + auction.duration {
            panic!("auction ended");
        }

        // Check rate limiting
        Self::check_rate_limit(&e, &bidder, &auction)?;

        // Store commitment
        auction.winner_commitments.set(bidder.clone(), commitment.clone());
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        // Store commit-reveal data
        let commit_reveal = CommitReveal {
            commitment: commitment.clone(),
            reveal_hash: None,
            reveal_time: None,
            amount: None,
            revealed: false,
        };
        e.storage().instance().set(&DataKey::CommitReveal(commitment.clone()), &commit_reveal);

        // Update rate limiter
        Self::update_rate_limiter(&e, &bidder);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("bid_committed"), auction_id.clone()),
            (bidder, commitment),
        );
    }

    // Reveal a bid
    pub fn reveal_bid(e: Env, auction_id: BytesN<32>, bidder: Address, amount: i128, nonce: u32) {
        bidder.require_auth();

        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Active {
            panic!("auction not active");
        }

        // Get commitment
        let commitment = auction.winner_commitments.get(bidder.clone())
            .unwrap_or_else(|| panic!("commitment not found"));

        let mut commit_reveal: CommitReveal = e.storage().instance().get(&DataKey::CommitReveal(commitment.clone()))
            .unwrap_or_else(|| panic!("commit-reveal data not found"));

        if commit_reveal.revealed {
            panic!("bid already revealed");
        }

        // Verify commitment
        let expected_commitment = Self::calculate_commitment(&e, amount, nonce);
        if expected_commitment != commitment {
            panic!("invalid commitment");
        }

        // Process the revealed bid
        Self::process_bid(&e, &mut auction, &bidder, amount)?;

        // Update commit-reveal data
        commit_reveal.revealed = true;
        commit_reveal.amount = Some(amount);
        commit_reveal.reveal_time = Some(e.ledger().timestamp());
        e.storage().instance().set(&DataKey::CommitReveal(commitment.clone()), &commit_reveal);

        // Remove from winner commitments
        auction.winner_commitments.remove(bidder.clone());
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("bid_revealed"), auction_id.clone()),
            (bidder, amount),
        );
    }

    // Place a direct bid (without commit-reveal)
    pub fn place_bid(e: Env, auction_id: BytesN<32>, bidder: Address, amount: i128) {
        bidder.require_auth();

        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Active {
            panic!("auction not active");
        }

        // Check rate limiting
        Self::check_rate_limit(&e, &bidder, &auction)?;

        // Process the bid
        Self::process_bid(&e, &mut auction, &bidder, amount)?;

        // Update rate limiter
        Self::update_rate_limiter(&e, &bidder);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("bid_placed"), auction_id.clone()),
            (bidder, amount),
        );
    }

    // End an auction
    pub fn end_auction(e: Env, auction_id: BytesN<32>) {
        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Active {
            panic!("auction not active");
        }

        let end_time = auction.start_time + auction.duration + auction.final_extension_time;
        if e.ledger().timestamp() < end_time {
            panic!("auction not ended");
        }

        // Process final refunds for any price differences
        Self::process_final_refunds(&e, &mut auction);

        auction.status = AuctionStatus::Ended;
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        // Remove from active auctions
        let mut active: Vec<BytesN<32>> = e.storage().instance().get(&DataKey::ActiveAuctions).unwrap();
        active.remove_first(|id| id == &auction_id);
        e.storage().instance().set(&DataKey::ActiveAuctions, &active);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("auction_ended"), auction_id.clone()),
            auction.sold_tickets,
        );
    }

    // Cancel an auction
    pub fn cancel_auction(e: Env, auction_id: BytesN<32>) {
        let mut auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status == AuctionStatus::Ended || auction.status == AuctionStatus::Cancelled {
            panic!("auction already ended or cancelled");
        }

        auction.organizer.require_auth();

        // Refund all bids
        Self::refund_all_bids(&e, &mut auction);

        auction.status = AuctionStatus::Cancelled;
        e.storage().instance().set(&DataKey::Auction(auction_id.clone()), &auction);

        // Remove from active auctions if it was active
        if auction.status == AuctionStatus::Active {
            let mut active: Vec<BytesN<32>> = e.storage().instance().get(&DataKey::ActiveAuctions).unwrap();
            active.remove_first(|id| id == &auction_id);
            e.storage().instance().set(&DataKey::ActiveAuctions, &active);
        }

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("auction_cancelled"), auction_id.clone()),
            (),
        );
    }

    // Get current price
    pub fn get_current_price(e: Env, auction_id: BytesN<32>) -> i128 {
        let auction: Auction = e.storage().instance().get(&DataKey::Auction(auction_id.clone()))
            .unwrap_or_else(|| panic!("auction not found"));

        if auction.status != AuctionStatus::Active {
            return auction.current_price;
        }

        let elapsed = e.ledger().timestamp().saturating_sub(auction.start_time);
        let time_elapsed = elapsed.min(auction.duration + auction.final_extension_time);
        
        Self::calculate_price(auction.initial_price, auction.floor_price, auction.decay_constant, time_elapsed)
    }

    // Admin functions
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

    pub fn update_config(e: Env, new_config: AuctionConfig) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_config(&new_config);
        e.storage().instance().set(&DataKey::AuctionConfig, &new_config);
    }

    // View functions
    pub fn get_auction(e: Env, auction_id: BytesN<32>) -> Auction {
        e.storage().instance().get(&DataKey::Auction(auction_id))
            .unwrap_or_else(|| panic!("auction not found"))
    }

    pub fn get_active_auctions(e: Env) -> Vec<BytesN<32>> {
        e.storage().instance().get(&DataKey::ActiveAuctions).unwrap_or(Vec::new(&e))
    }

    pub fn get_user_auctions(e: Env, user: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::UserAuctions(user))
            .unwrap_or(Vec::new(&e))
    }

    pub fn get_user_bids(e: Env, user: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::UserBids(user))
            .unwrap_or(Vec::new(&e))
    }

    pub fn get_config(e: Env) -> AuctionConfig {
        e.storage().instance().get(&DataKey::AuctionConfig).unwrap()
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn validate_config(config: &AuctionConfig) {
        if config.max_concurrent_auctions == 0 {
            panic!("max concurrent auctions must be positive");
        }

        if config.min_duration == 0 || config.max_duration == 0 || config.min_duration > config.max_duration {
            panic!("invalid duration settings");
        }

        if config.default_duration < config.min_duration || config.default_duration > config.max_duration {
            panic!("default duration out of range");
        }

        if config.decay_constant == 0 {
            panic!("decay constant must be positive");
        }
    }

    fn validate_auction_params(
        e: &Env,
        initial_price: i128,
        reserve_price: i128,
        floor_price: i128,
        decay_constant: u32,
        duration: u64,
        total_tickets: u32,
    ) -> Result<(), DutchAuctionError> {
        if initial_price <= 0 || reserve_price <= 0 || floor_price <= 0 {
            return Err(DutchAuctionError::InvalidAmount);
        }

        if reserve_price >= initial_price {
            return Err(DutchAuctionError::BelowReservePrice);
        }

        if floor_price >= reserve_price {
            return Err(DutchAuctionError::BelowFloorPrice);
        }

        if decay_constant == 0 {
            return Err(DutchAuctionError::InvalidDecayConstant);
        }

        let config: AuctionConfig = e.storage().instance().get(&DataKey::AuctionConfig).unwrap();
        if duration < config.min_duration || duration > config.max_duration {
            return Err(DutchAuctionError::InvalidTime);
        }

        if total_tickets == 0 {
            return Err(DutchAuctionError::NoTicketsAvailable);
        }

        Ok(())
    }

    fn calculate_price(initial_price: i128, floor_price: i128, decay_constant: u32, time_elapsed: u64) -> i128 {
        if time_elapsed == 0 {
            return initial_price;
        }

        // Exponential decay: P(t) = P0 * e^(-kt) + floor_price
        // Using integer arithmetic approximation
        let decay_factor = decay_constant as u64;
        let decay_numerator = decay_factor * time_elapsed;
        
        // Prevent overflow
        if decay_numerator > 1000000 {
            return floor_price;
        }

        let decay_multiplier = 1000000 - (decay_numerator / 100); // Simplified decay
        if decay_multiplier <= 0 {
            return floor_price;
        }

        let price_above_floor = (initial_price - floor_price) * decay_multiplier as i128 / 1000000;
        floor_price + price_above_floor
    }

    fn process_bid(e: &Env, auction: &mut Auction, bidder: &Address, amount: i128) -> Result<(), DutchAuctionError> {
        // Check if auction is still active
        let end_time = auction.start_time + auction.duration + auction.final_extension_time;
        if e.ledger().timestamp() > end_time {
            return Err(DutchAuctionError::AuctionEnded);
        }

        // Check if tickets are available
        if auction.sold_tickets >= auction.total_tickets {
            return Err(DutchAuctionError::NoTicketsAvailable);
        }

        // Get current price
        let current_price = Self::get_current_price(e, auction.id.clone());
        
        // Check if bid meets minimum price
        if amount < current_price {
            return Err(DutchAuctionError::BidTooLow);
        }

        // Check minimum bid increment
        if !auction.bids.is_empty() {
            let highest_bid = auction.bids.iter().map(|b| b.amount).max().unwrap();
            if amount < highest_bid + auction.min_bid_increment {
                return Err(DutchAuctionError::BidTooLow);
            }
        }

        // Transfer tokens to contract
        let token_client = soroban_sdk::token::Client::new(e, &auction.token);
        let contract_address = e.current_contract_address();
        
        token_client.transfer(bidder, &contract_address, &amount);

        // Create bid
        let bid = Bid {
            bidder: bidder.clone(),
            amount,
            timestamp: e.ledger().timestamp(),
            commitment: None,
            revealed: true,
            ticket_ids: Vec::new(e),
            refund_amount: 0,
        };

        // Add bid
        auction.bids.push_back(bid);
        auction.sold_tickets += 1;

        // Update current price
        auction.current_price = current_price;

        // Check for auction extension
        if e.ledger().timestamp() > end_time - auction.extension_threshold {
            auction.final_extension_time += auction.extension_duration;
        }

        // Add to user's bids
        let user_bids_key = DataKey::UserBids(bidder.clone());
        let mut user_bids: Vec<BytesN<32>> = e.storage().persistent().get(&user_bids_key).unwrap_or(Vec::new(e));
        user_bids.push_back(auction.id.clone());
        e.storage().persistent().set(&user_bids_key, &user_bids);

        Ok(())
    }

    fn check_rate_limit(e: &Env, bidder: &Address, auction: &Auction) -> Result<(), DutchAuctionError> {
        if !auction.anti_bot_enabled {
            return Ok(());
        }

        let config: AuctionConfig = e.storage().instance().get(&DataKey::AuctionConfig).unwrap();
        let rate_limiter_key = DataKey::RateLimiter(bidder.clone());
        
        let mut rate_limiter: RateLimiter = e.storage().persistent().get(&rate_limiter_key)
            .unwrap_or(RateLimiter {
                address: bidder.clone(),
                bid_count: 0,
                window_start: e.ledger().timestamp(),
                last_bid_time: 0,
            });

        let current_time = e.ledger().timestamp();
        
        // Reset window if needed
        if current_time - rate_limiter.window_start > config.rate_limit_window {
            rate_limiter.bid_count = 0;
            rate_limiter.window_start = current_time;
        }

        // Check rate limit
        if rate_limiter.bid_count >= config.rate_limit_max_bids {
            return Err(DutchAuctionError::RateLimitExceeded);
        }

        // Check for front-running (very rapid bids)
        if current_time - rate_limiter.last_bid_time < 1 {
            return Err(DutchAuctionError::FrontRunningDetected);
        }

        Ok(())
    }

    fn update_rate_limiter(e: &Env, bidder: &Address) {
        let rate_limiter_key = DataKey::RateLimiter(bidder.clone());
        let mut rate_limiter: RateLimiter = e.storage().persistent().get(&rate_limiter_key)
            .unwrap_or(RateLimiter {
                address: bidder.clone(),
                bid_count: 0,
                window_start: e.ledger().timestamp(),
                last_bid_time: 0,
            });

        rate_limiter.bid_count += 1;
        rate_limiter.last_bid_time = e.ledger().timestamp();
        e.storage().persistent().set(&rate_limiter_key, &rate_limiter);
    }

    fn calculate_commitment(e: &Env, amount: i128, nonce: u32) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(amount.into_val(e));
        data.push_back(nonce.into_val(e));
        e.crypto().sha256(&data.to_bytes())
    }

    fn process_final_refunds(e: &Env, auction: &mut Auction) {
        let token_client = soroban_sdk::token::Client::new(e, &auction.token);
        let contract_address = e.current_contract_address();

        // Sort bids by amount (highest first)
        let mut bids = auction.bids.clone();
        bids.sort_by(|a, b| b.amount.cmp(&a.amount));

        let mut ticket_prices = Vec::new(e);
        
        // Calculate price for each ticket sold
        for i in 0..auction.sold_tickets {
            let ticket_time = (i as u64) * (auction.duration / auction.sold_tickets as u64);
            let ticket_price = Self::calculate_price(
                auction.initial_price,
                auction.floor_price,
                auction.decay_constant,
                ticket_time,
            );
            ticket_prices.push_back(ticket_price);
        }

        // Process refunds for overpayment
        for (i, bid) in bids.iter().enumerate() {
            if i < ticket_prices.len() {
                let ticket_price = ticket_prices.get(i).unwrap();
                if bid.amount > ticket_price {
                    let refund_amount = bid.amount - ticket_price;
                    if refund_amount > 0 {
                        token_client.transfer(&contract_address, &bid.bidder, &refund_amount);
                    }
                }
            }
        }
    }

    fn refund_all_bids(e: &Env, auction: &mut Auction) {
        let token_client = soroban_sdk::token::Client::new(e, &auction.token);
        let contract_address = e.current_contract_address();

        for bid in auction.bids.iter() {
            token_client.transfer(&contract_address, &bid.bidder, &bid.amount);
        }
    }

    fn generate_auction_id(e: &Env, organizer: &Address, token: &Address, initial_price: i128) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(organizer.to_val());
        data.push_back(token.to_val());
        data.push_back(initial_price.into_val(e));
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }
}
