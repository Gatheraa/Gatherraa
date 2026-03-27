use soroban_sdk::Env;

/// Number of seconds in one day.
pub const SECONDS_PER_DAY: u64 = 86_400;

/// Convert days to seconds
pub fn days_to_seconds(days: u32) -> u64 {
    days as u64 * SECONDS_PER_DAY
}

/// Convert seconds to days
pub fn seconds_to_days(seconds: u64) -> u32 {
    (seconds / SECONDS_PER_DAY) as u32
}

/// Get current timestamp
pub fn get_current_timestamp(env: &Env) -> u64 {
    env.ledger().timestamp()
}

/// Check if timestamp is in the past
pub fn is_past(env: &Env, timestamp: u64) -> bool {
    env.ledger().timestamp() > timestamp
}

/// Check if timestamp is in the future
pub fn is_future(env: &Env, timestamp: u64) -> bool {
    env.ledger().timestamp() < timestamp
}

/// Calculate percentage of a value
pub fn calculate_percentage(value: i128, percentage: u32) -> i128 {
    (value * percentage as i128) / 100
}

/// Validate price is positive
pub fn validate_price(price: i128) -> Result<(), &'static str> {
    if price <= 0 {
        return Err("Price must be positive");
    }
    Ok(())
}

/// Validate duration is reasonable
pub fn validate_duration(days: u32) -> Result<(), &'static str> {
    if days == 0 {
        return Err("Duration must be at least 1 day");
    }
    if days > 365 * 10 {
        return Err("Duration cannot exceed 10 years");
    }
    Ok(())
}
