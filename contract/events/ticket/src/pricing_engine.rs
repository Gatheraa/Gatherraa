use soroban_sdk::{Address, Env, String, Symbol};

use crate::storage_types::{PricingConfig, PricingStrategy};
use crate::oracle::{fetch_price_with_fallback, oracle_price_to_multiplier};

/// Simplified pricing engine
pub struct PricingEngine;

impl PricingEngine {
    /// Calculate ticket price with basic dynamic pricing
    pub fn calculate_price(
        e: &Env,
        config: &PricingConfig,
        base_price: i128,
        tier: u32,
        quantity: u32,
    ) -> i128 {
        // Early bird discount
        let current_time = e.ledger().timestamp();
        let early_bird_discount = if current_time < config.last_update_time + 86400 {
            base_price * 1000 / 10000 // 10% max discount
        } else {
            0
        };

        // Tier-based pricing
        let tier_multiplier = match tier {
            0 => 100, // Base tier
            1 => 120, // 20% premium
            2 => 150, // 50% premium
            _ => 200, // 100% premium for VIP
        };

        // Quantity discount
        let quantity_discount = if quantity > 10 {
            500 // 5% discount for bulk
        } else if quantity > 5 {
            200 // 2% discount
        } else {
            0
        };

        // Oracle-based adjustment
        let oracle_multiplier = if !config.is_frozen {
            fetch_price_with_fallback(e, &config.oracle_address, &config.oracle_pair)
                .map(|price| oracle_price_to_multiplier(price, config.oracle_reference_price))
                .unwrap_or(10000) // Default 1x multiplier
        } else {
            10000 // Frozen pricing
        };

        let adjusted_price = base_price * tier_multiplier / 100;
        let final_price = adjusted_price * oracle_multiplier / 10000;
        
        // Apply discounts
        let discounted_price = final_price - early_bird_discount - (final_price * quantity_discount / 10000);
        
        // Apply bounds
        discounted_price
            .max(config.price_floor)
            .min(config.price_ceiling)
    }

    /// Validate pricing configuration
    pub fn validate_config(config: &PricingConfig) -> Result<(), String> {
        if config.price_floor >= config.price_ceiling {
            return Err("Invalid price bounds".into());
        }
        
        if config.update_frequency == 0 {
            return Err("Invalid update frequency".into());
        }
        
        Ok(())
    }

    /// Check if pricing update is needed
    pub fn should_update_pricing(e: &Env, config: &PricingConfig) -> bool {
        let current_time = e.ledger().timestamp();
        current_time >= config.last_update_time + config.update_frequency
    }
}
