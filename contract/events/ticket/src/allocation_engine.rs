use soroban_sdk::{Address, Env, Vec, Symbol};

use crate::storage_types::{AllocationConfig, AllocationStrategyType, AllocationResult};

/// Simplified allocation engine
pub struct AllocationEngine;

impl AllocationEngine {
    /// Allocate tickets using simplified strategy
    pub fn allocate(
        e: &Env,
        config: &AllocationConfig,
        user: Address,
        quantity: u32,
        total_supply: u32,
        current_sold: u32,
    ) -> AllocationResult {
        match config.strategy_type {
            AllocationStrategyType::FirstComeFirstServe => {
                Self::fcfs_allocate(e, user, quantity, total_supply, current_sold)
            }
            AllocationStrategyType::Lottery => {
                Self::lottery_allocate(e, user, quantity, config.lottery_weight)
            }
            AllocationStrategyType::Tiered => {
                Self::tiered_allocate(e, user, quantity, config.tier_limits)
            }
        }
    }

    /// First-come-first-serve allocation
    fn fcfs_allocate(
        e: &Env,
        user: Address,
        quantity: u32,
        total_supply: u32,
        current_sold: u32,
    ) -> AllocationResult {
        if current_sold + quantity > total_supply {
            return AllocationResult {
                success: false,
                allocated_quantity: 0,
                reason: Symbol::new(e, "insufficient_supply"),
            };
        }

        AllocationResult {
            success: true,
            allocated_quantity: quantity,
            reason: Symbol::new(e, "success"),
        }
    }

    /// Lottery-based allocation
    fn lottery_allocate(
        e: &Env,
        user: Address,
        quantity: u32,
        weight: u32,
    ) -> AllocationResult {
        // Simplified lottery logic
        let random_value = e.ledger().timestamp() % 100;
        let threshold = weight.min(100);

        if random_value < threshold {
            AllocationResult {
                success: true,
                allocated_quantity: quantity,
                reason: Symbol::new(e, "lottery_win"),
            }
        } else {
            AllocationResult {
                success: false,
                allocated_quantity: 0,
                reason: Symbol::new(e, "lottery_lose"),
            }
        }
    }

    /// Tiered allocation
    fn tiered_allocate(
        e: &Env,
        user: Address,
        quantity: u32,
        tier_limits: Vec<u32>,
    ) -> AllocationResult {
        // Simplified tier logic - check against first tier limit
        if tier_limits.is_empty() {
            return AllocationResult {
                success: true,
                allocated_quantity: quantity,
                reason: Symbol::new(e, "no_tier_limit"),
            };
        }

        let limit = tier_limits.get(0).unwrap_or(&quantity);
        if quantity <= *limit {
            AllocationResult {
                success: true,
                allocated_quantity: quantity,
                reason: Symbol::new(e, "tier_approved"),
            }
        } else {
            AllocationResult {
                success: false,
                allocated_quantity: 0,
                reason: Symbol::new(e, "tier_limit_exceeded"),
            }
        }
    }

    /// Validate allocation configuration
    pub fn validate_config(config: &AllocationConfig) -> Result<(), String> {
        match config.strategy_type {
            AllocationStrategyType::Lottery => {
                if config.lottery_weight == 0 || config.lottery_weight > 100 {
                    return Err("Invalid lottery weight".into());
                }
            }
            AllocationStrategyType::Tiered => {
                if config.tier_limits.is_empty() {
                    return Err("Tier limits required".into());
                }
            }
            _ => {}
        }
        Ok(())
    }
}
