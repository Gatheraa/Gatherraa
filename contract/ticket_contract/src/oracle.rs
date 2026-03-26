/// oracle.rs — Real Stellar/Soroban Oracle Integration
///
/// Implements a DIA-compatible oracle client for cross-contract price data retrieval,
/// with automatic staleness detection and a Stellar DEX fallback mechanism.
///
/// DIA Oracle testnet contract addresses (Testnet):
///   - Market prices: CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63
///   - Fiat rates:    CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W
///
/// DIA oracle interface (Rust representation):
///   get_value(key: String) -> (i128, u64)
///     - i128: price with 8 decimal places (e.g. 100_000_000 = $1.00)
///     - u64:  UNIX timestamp of the last price update
use soroban_sdk::{contractclient, symbol_short, Address, Env, IntoVal, String, TryFromVal, Val};

/// How long (in seconds) a price is considered fresh. Default: 24 hours.
pub const DEFAULT_STALENESS_SECONDS: u64 = 86_400;

/// DIA oracle returns prices with 8 decimal places: 1.0 == 100_000_000
pub const DIA_ORACLE_DECIMALS: i128 = 100_000_000;

/// Validates that an address points to a deployed contract
pub fn validate_contract_address(e: &Env, address: &Address) -> Result<(), &'static str> {
    // Check if the address is a contract by attempting to get its instance
    match e.try_invoke_contract::<Val>(address, &symbol_short!("__constructor"), Vec::new(e)) {
        Ok(_) => Ok(()),
        Err(_) => Err("invalid contract address"),
    }
}

// --------------------------------------------------------------------------
// DIA Oracle client
//
// DIA exposes a single function:
//   get_value(key: soroban_sdk::String) -> (i128, u64)
//
// We define the trait using `contractclient` so the SDK generates a typed
// client struct (`DiaOraclePriceClient`) for us automatically at compile time.
// --------------------------------------------------------------------------

/// Trait mirroring the on-chain DIA Oracle public interface.
/// `contractclient` generates `DiaOraclePriceClient` from this.
#[contractclient(name = "DiaOraclePriceClient")]
pub trait DiaOracleInterface {
    /// Returns (price_8decimals, unix_timestamp).
    fn get_value(env: Env, pair: String) -> (i128, u64);
}

// --------------------------------------------------------------------------
// DIA Oracle client
//
// DIA exposes a single function:
//   get_value(key: soroban_sdk::String) -> (i128, u64)
//
// We define the trait using `contractclient` so the SDK generates a typed
// client struct (`DiaOraclePriceClient`) for us automatically at compile time.
// --------------------------------------------------------------------------

/// Trait mirroring the on-chain DIA Oracle public interface.
/// `contractclient` generates `DiaOraclePriceClient` from this.
#[contractclient(name = "DiaOraclePriceClient")]
pub trait DiaOracleInterface {
    /// Returns (price_8decimals, unix_timestamp).
    fn get_value(env: Env, pair: String) -> (i128, u64);
}

// --------------------------------------------------------------------------
// Stellar DEX fallback client
//
// If the oracle is stale or unavailable we fall back to an AMM / liquidity
// pool router that exposes `get_spot_price(pair)` returning an i128.
// --------------------------------------------------------------------------

/// Trait mirroring a minimal DEX pool or price-router interface.
/// `contractclient` generates `DexPriceRouterClient`.
#[contractclient(name = "DexPriceRouterClient")]
pub trait DexPriceRouterInterface {
    /// Returns the current spot price of `pair` expressed in the same
    /// 8-decimal format as DIA (100_000_000 == $1.00).
    fn get_spot_price(env: Env, pair: String) -> i128;
}

// --------------------------------------------------------------------------
// Fetching logic
// --------------------------------------------------------------------------

/// Result returned by `fetch_oracle_price`.
pub struct OracleResult {
    /// Price with 8 decimal places.
    pub price: i128,
    /// UNIX timestamp when this price was last updated on-chain.
    pub timestamp: u64,
    /// Whether this came from the primary oracle (true) or DEX fallback (false).
    pub from_primary: bool,
}

/// Fetch a live price from the DIA oracle at `oracle_address` for `pair`
/// (e.g. `"XLM/USD"`).
///
/// # Staleness guard
/// If the price timestamp is older than `max_age_seconds`, the function
/// panics with an informative message so the caller can decide to fall back.
///
/// # Returns
/// `OracleResult` with `from_primary = true`.
pub fn fetch_primary_oracle_price(
    e: &Env,
    oracle_address: &Address,
    pair: String,
    max_age_seconds: u64,
) -> OracleResult {
    // Validate oracle contract address
    if let Err(err) = validate_contract_address(e, oracle_address) {
        panic!("oracle address validation failed: {}", err);
    }

    let client = DiaOraclePriceClient::new(e, oracle_address);
    let (raw_price, timestamp) = client.get_value(&pair);

    // Staleness check
    let now = e.ledger().timestamp();
    if now > timestamp && (now - timestamp) > max_age_seconds {
        panic!("oracle price is stale");
    }

    OracleResult {
        price: raw_price,
        timestamp,
        from_primary: true,
    }
}

/// Fetch a spot price from the DEX router at `dex_address` for `pair`.
/// This is the fallback when the primary oracle is unavailable or stale.
pub fn fetch_dex_price(e: &Env, dex_address: &Address, pair: String) -> OracleResult {
    // Validate DEX contract address
    if let Err(err) = validate_contract_address(e, dex_address) {
        panic!("dex address validation failed: {}", err);
    }

    let client = DexPriceRouterClient::new(e, dex_address);
    let raw_price = client.get_spot_price(&pair);

    OracleResult {
        price: raw_price,
        timestamp: e.ledger().timestamp(),
        from_primary: false,
    }
}

/// High-level helper: try the primary oracle first; fall back to the DEX
/// router if the oracle is stale or panics.
///
/// Returns `None` only when both sources are unavailable (to let the caller
/// choose between using the cached price or panicking).
pub fn fetch_price_with_fallback(
    e: &Env,
    oracle_address: &Address,
    dex_address: &Address,
    pair: String,
    max_age_seconds: u64,
) -> Option<OracleResult> {
    // Validate addresses
    if let Err(err) = validate_contract_address(e, oracle_address) {
        // Log validation failure but continue to fallback
        e.events().publish((symbol_short!("oracle_validation_failed"),), err);
    }
    if let Err(err) = validate_contract_address(e, dex_address) {
        e.events().publish((symbol_short!("dex_validation_failed"),), err);
    }

    // --- Primary oracle ---
    let client = DiaOraclePriceClient::new(e, oracle_address);
    let oracle_result = client.try_get_value(&pair);

    if let Ok(Ok((raw_price, timestamp))) = oracle_result {
        let now = e.ledger().timestamp();
        // Accept if fresh enough
        if now <= timestamp || (now - timestamp) <= max_age_seconds {
            // Log successful oracle call
            e.events().publish((symbol_short!("oracle_call_success"),), true);
            return Some(OracleResult {
                price: raw_price,
                timestamp,
                from_primary: true,
            });
        }
        // Log stale price
        e.events().publish((symbol_short!("oracle_price_stale"),), timestamp);
    } else {
        // Log oracle call failure
        e.events().publish((symbol_short!("oracle_call_failed"),), true);
    }

    // --- DEX fallback ---
    let dex_client = DexPriceRouterClient::new(e, dex_address);
    let dex_result = dex_client.try_get_spot_price(&pair);

    if let Ok(Ok(raw_price)) = dex_result {
        // Log successful DEX call
        e.events().publish((symbol_short!("dex_call_success"),), true);
        return Some(OracleResult {
            price: raw_price,
            timestamp: e.ledger().timestamp(),
            from_primary: false,
        });
    } else {
        // Log DEX call failure
        e.events().publish((symbol_short!("dex_call_failed"),), true);
    }

    // Both unavailable
    e.events().publish((symbol_short!("price_fetch_failed"),), pair);
    None
}

/// Convert a raw DIA price (8 decimals) into a `ORACLE_PRECISION`-scaled
/// multiplier that can be applied directly to a ticket base price.
///
/// For example, if the oracle reports that the asset is worth 110_000_000
/// (i.e. $1.10) relative to a $1.00 baseline, this returns 11_000 when
/// `ORACLE_PRECISION == 10_000`.
///
/// In practice for this contract the multiplier expresses how external
/// market conditions should adjust the ticket price.  A neutral market =
/// `oracle_precision` (1x).  Use `reference_price_8dec` = the expected
/// baseline price from the oracle (e.g. last known good price or 1 USD).
pub fn oracle_price_to_multiplier(
    raw_price: i128,
    reference_price_8dec: i128,
    oracle_precision: i128,
) -> i128 {
    if reference_price_8dec == 0 {
        return oracle_precision; // no basis for ratio — neutral
    }
    (raw_price * oracle_precision) / reference_price_8dec
}
