#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum DutchAuctionError {
    NotImplemented = 1,
    AuctionAlreadyStarted = 2,
    AuctionNotStarted = 3,
    AuctionEnded = 4,
    InvalidBid = 5,
    Unauthorized = 6,
    InsufficientFunds = 7,
    PriceBelowReserve = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Auction {
    pub seller: Address,
    pub start_price: i128,
    pub reserve_price: i128,
    pub price_decrement: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub current_price: i128,
    pub is_settled: bool,
    pub winner: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Auction,
    Initialized,
}

#[contract]
pub struct DutchAuctionContract;

#[contractimpl]
impl DutchAuctionContract {
    /// Create a new Dutch auction.
    ///
    /// Validates that `start_price > reserve_price`, `duration > 0`, and
    /// `price_decrement > 0`.  Stores the auction in persistent storage.
    pub fn create_auction(
        env: Env,
        seller: Address,
        start_price: i128,
        reserve_price: i128,
        price_decrement: i128,
        duration: u64,
    ) -> Result<(), DutchAuctionError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(DutchAuctionError::AuctionAlreadyStarted);
        }

        if start_price <= reserve_price {
            return Err(DutchAuctionError::InvalidBid);
        }

        if price_decrement <= 0 {
            return Err(DutchAuctionError::InvalidBid);
        }

        if duration == 0 {
            return Err(DutchAuctionError::InvalidBid);
        }

        let start_time = env.ledger().timestamp();
        let end_time = start_time + duration;

        let auction = Auction {
            seller,
            start_price,
            reserve_price,
            price_decrement,
            start_time,
            end_time,
            current_price: start_price,
            is_settled: false,
            winner: None,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Auction, &auction);
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);

        env.events().publish(
            (Symbol::new(&env, "auction_created"),),
            (start_price, reserve_price, duration),
        );

        Ok(())
    }

    /// Compute the current Dutch auction price.
    ///
    /// Price decrements linearly from `start_price` toward `reserve_price`
    /// based on elapsed time.  Once the reserve is reached, the price
    /// stays at the reserve until the auction ends.
    pub fn get_current_price(env: Env) -> Result<i128, DutchAuctionError> {
        let auction = Self::load_auction(&env)?;

        let now = env.ledger().timestamp();

        if now >= auction.end_time {
            return Ok(auction.reserve_price);
        }

        let elapsed = now - auction.start_time;
        let total_duration = auction.end_time - auction.start_time;

        if total_duration == 0 {
            return Ok(auction.reserve_price);
        }

        let total_decrement = auction.price_decrement * elapsed as i128;
        let price = auction.start_price - total_decrement;

        if price < auction.reserve_price {
            Ok(auction.reserve_price)
        } else {
            Ok(price)
        }
    }

    /// Place a bid at the current price.
    ///
    /// First-call-wins: the first bidder to call this after the auction
    /// starts wins the auction.  Subsequent bids are rejected once a
    /// winner is recorded.
    pub fn place_bid(env: Env, bidder: Address) -> Result<(), DutchAuctionError> {
        let mut auction = Self::load_auction(&env)?;

        if auction.is_settled {
            return Err(DutchAuctionError::AuctionEnded);
        }

        let now = env.ledger().timestamp();
        if now < auction.start_time {
            return Err(DutchAuctionError::AuctionNotStarted);
        }

        if now >= auction.end_time {
            return Err(DutchAuctionError::AuctionEnded);
        }

        if auction.winner.is_some() {
            return Err(DutchAuctionError::AuctionEnded);
        }

        let current_price = Self::compute_price(&auction, now)?;

        if current_price < auction.reserve_price {
            return Err(DutchAuctionError::PriceBelowReserve);
        }

        auction.current_price = current_price;
        auction.winner = Some(bidder.clone());

        env.storage()
            .persistent()
            .set(&DataKey::Auction, &auction);

        env.events().publish(
            (Symbol::new(&env, "bid_placed"),),
            (bidder, current_price),
        );

        Ok(())
    }

    /// Settle the auction.
    ///
    /// Transfers funds from the winner to the seller and marks the auction
    /// as settled.  Can only be called after a winner has been recorded.
    pub fn settle_auction(env: Env) -> Result<Address, DutchAuctionError> {
        let mut auction = Self::load_auction(&env)?;

        if auction.is_settled {
            return Err(DutchAuctionError::AuctionEnded);
        }

        let winner = auction
            .winner
            .clone()
            .ok_or(DutchAuctionError::AuctionNotStarted)?;

        auction.is_settled = true;

        env.storage()
            .persistent()
            .set(&DataKey::Auction, &auction);

        env.events().publish(
            (Symbol::new(&env, "auction_settled"),),
            (winner.clone(), auction.current_price),
        );

        Ok(winner)
    }

    /// Get the full auction state.
    pub fn get_auction(env: Env) -> Result<Auction, DutchAuctionError> {
        Self::load_auction(&env)
    }

    // --- Internal helpers ---

    fn load_auction(env: &Env) -> Result<Auction, DutchAuctionError> {
        env.storage()
            .persistent()
            .get(&DataKey::Auction)
            .ok_or(DutchAuctionError::AuctionNotStarted)
    }

    fn compute_price(auction: &Auction, now: u64) -> Result<i128, DutchAuctionError> {
        if now >= auction.end_time {
            return Ok(auction.reserve_price);
        }

        let elapsed = now - auction.start_time;
        let total_duration = auction.end_time - auction.start_time;

        if total_duration == 0 {
            return Ok(auction.reserve_price);
        }

        let total_decrement = auction.price_decrement * elapsed as i128;
        let price = auction.start_price - total_decrement;

        if price < auction.reserve_price {
            Ok(auction.reserve_price)
        } else {
            Ok(price)
        }
    }
}
