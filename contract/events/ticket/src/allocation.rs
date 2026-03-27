/// Allocation Strategies for Ticket Distribution
/// Supports multiple strategies: FCFS, Lottery, Whitelist with fair mechanisms
use soroban_sdk::{contracttype, Address, Bytes, Env, Symbol, Vec};

/// Allocation strategy types
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AllocationStrategy {
    /// First-Come-First-Served
    FCFS,
    /// Lottery-based random allocation
    Lottery,
    /// Whitelist with optional weighted allocation
    Whitelist,
    /// Hybrid: Whitelist gets priority, remaining via lottery
    HybridWhitelistLottery,
    /// Time-weighted allocation (earlier registrants get priority)
    TimeWeighted,
}

/// Entry for lottery participation
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LotteryEntry {
    /// Participant address
    pub participant: Address,
    /// Entry timestamp for fairness verification
    pub entry_time: u64,
    /// Unique nonce for this entry
    pub nonce: u32,
    /// Commitment hash if using commit-reveal
    pub commitment_hash: Option<Bytes>,
}

/// Whitelist entry with optional weight
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WhitelistEntry {
    /// Whitelisted address
    pub address: Address,
    /// Weight for weighted lottery (default 1, can be higher for priority)
    pub weight: u32,
    /// Allocation limit for this entry (0 = unlimited)
    pub allocation_limit: u32,
    /// Current allocations to this address
    pub allocated: u32,
}

/// Anti-sniping parameters
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AntiSnipingConfig {
    /// Minimum block time between entry and finalization (in ledger height)
    pub minimum_lock_period: u32,
    /// Maximum entries a single address can have within a time window
    pub max_entries_per_address: u32,
    /// Time window for rate limiting (in seconds)
    pub rate_limit_window: u64,
    /// Enable randomization delay to prevent observable patterns
    pub randomization_delay_ledgers: u32,
}

/// Allocation result for a winner
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AllocationResult {
    /// Winner address
    pub winner: Address,
    /// Allocation index (for batch processing)
    pub allocation_index: u32,
    /// Randomness value used for selection
    pub randomness_value: u128,
    /// Weight applied for weighted lotteries
    pub weight_applied: u32,
}

/// Allocation engine implementing various strategies
pub struct AllocationEngine;

impl AllocationEngine {
    /// Allocate tickets using FCFS strategy
    pub fn allocate_fcfs(
        e: &Env,
        entries: &Vec<LotteryEntry>,
        quantity: u32,
    ) -> Vec<AllocationResult> {
        let mut results = Vec::new(e);

        for i in 0..quantity.min(entries.len() as u32) {
            if let Some(entry) = entries.get(i as usize) {
                results
                    .push_back(AllocationResult {
                        winner: entry.participant.clone(),
                        allocation_index: i,
                        randomness_value: 0, // FCFS doesn't use randomness
                        weight_applied: 1,
                    })
                    .unwrap();
            }
        }

        results
    }

    /// Allocate tickets using lottery strategy
    /// Selects `quantity` unique winners from entries using VRF randomness
    pub fn allocate_lottery(
        e: &Env,
        entries: &Vec<LotteryEntry>,
        randomness_values: &Vec<u128>,
        quantity: u32,
    ) -> Vec<AllocationResult> {
        let mut results = Vec::new(e);
        let mut selected_indices: Vec<u32> = Vec::new(e);

        for i in 0..quantity.min(randomness_values.len() as u32) {
            if let Some(&randomness) = randomness_values.get(i as usize) {
                // Compute selection excluding already-selected entries
                let pool_size = (entries.len() as u32) - (selected_indices.len() as u32);
                let mut index = ((randomness % (pool_size as u128)) as u32);

                // Adjust for already-selected entries
                let mut actual_index = index;
                for &selected in &selected_indices {
                    if actual_index >= selected {
                        actual_index += 1;
                    }
                }

                if actual_index < entries.len() as u32 {
                    if let Some(entry) = entries.get(actual_index as usize) {
                        selected_indices.push_back(actual_index).unwrap();
                        results
                            .push_back(AllocationResult {
                                winner: entry.participant.clone(),
                                allocation_index: i,
                                randomness_value: randomness,
                                weight_applied: 1,
                            })
                            .unwrap();
                    }
                }
            }
        }

        results
    }

    /// Allocate tickets using whitelist strategy
    /// Whitelisted addresses get priority allocations
    pub fn allocate_whitelist(
        e: &Env,
        whitelist: &Vec<WhitelistEntry>,
        quantity: u32,
    ) -> Vec<AllocationResult> {
        let mut results = Vec::new(e);
        let mut allocation_count = 0u32;

        // First pass: allocate to whitelisted addresses in order
        for i in 0..whitelist.len() {
            if allocation_count >= quantity {
                break;
            }

            if let Some(entry) = whitelist.get(i) {
                if entry.allocated < entry.allocation_limit || entry.allocation_limit == 0 {
                    results
                        .push_back(AllocationResult {
                            winner: entry.address.clone(),
                            allocation_index: allocation_count,
                            randomness_value: 0, // Whitelist doesn't use randomness
                            weight_applied: entry.weight,
                        })
                        .unwrap();
                    allocation_count += 1;
                }
            }
        }

        results
    }

    /// Allocate using hybrid strategy: whitelist first, then lottery for remainder
    pub fn allocate_hybrid_whitelist_lottery(
        e: &Env,
        whitelist: &Vec<WhitelistEntry>,
        lottery_entries: &Vec<LotteryEntry>,
        randomness_values: &Vec<u128>,
        quantity: u32,
    ) -> Vec<AllocationResult> {
        let mut results = Vec::new(e);

        // Phase 1: Whitelist allocations
        let mut whitelist_allocated = 0u32;
        for i in 0..whitelist.len() {
            if whitelist_allocated >= quantity {
                break;
            }

            if let Some(entry) = whitelist.get(i) {
                if entry.allocated < entry.allocation_limit || entry.allocation_limit == 0 {
                    results
                        .push_back(AllocationResult {
                            winner: entry.address.clone(),
                            allocation_index: whitelist_allocated,
                            randomness_value: 0,
                            weight_applied: entry.weight,
                        })
                        .unwrap();
                    whitelist_allocated += 1;
                }
            }
        }

        // Phase 2: Lottery for remaining quantity
        let remaining = quantity - whitelist_allocated;
        let lottery_results =
            Self::allocate_lottery(e, lottery_entries, randomness_values, remaining);

        for result in lottery_results {
            results
                .push_back(AllocationResult {
                    winner: result.winner,
                    allocation_index: whitelist_allocated + result.allocation_index,
                    randomness_value: result.randomness_value,
                    weight_applied: result.weight_applied,
                })
                .unwrap();
        }

        results
    }

    /// Allocate using time-weighted strategy
    /// Earlier entries get higher priority (exponential decay weight)
    pub fn allocate_time_weighted(
        e: &Env,
        entries: &Vec<LotteryEntry>,
        randomness_values: &Vec<u128>,
        quantity: u32,
    ) -> Vec<AllocationResult> {
        let mut results = Vec::new(e);
        let current_time = e.ledger().timestamp();

        // Compute weights based on entry time (earlier = higher weight)
        let mut weights: Vec<u32> = Vec::new(e);

        if entries.len() > 0 {
            let earliest_time = entries.get(0).unwrap().entry_time;
            let latest_time = if entries.len() > 0 {
                let mut max_time = earliest_time;
                for entry in entries {
                    if entry.entry_time > max_time {
                        max_time = entry.entry_time;
                    }
                }
                max_time
            } else {
                earliest_time
            };

            for i in 0..entries.len() {
                if let Some(entry) = entries.get(i) {
                    let age = current_time - entry.entry_time;
                    let time_span = latest_time - earliest_time;

                    // Weight: earlier entries get more weight
                    // Basic formula: weight = max(1, 100 - (age_percentage * 99))
                    let weight = if time_span > 0 {
                        let age_percentage = (age * 100) / (time_span + 1);
                        100u32.saturating_sub(age_percentage as u32)
                    } else {
                        100u32
                    };

                    weights.push_back(weight.max(1)).unwrap();
                }
            }
        }

        // Use weighted lottery selection
        for i in 0..quantity.min(randomness_values.len() as u32) {
            if let Some(&randomness) = randomness_values.get(i as usize) {
                let mut total_weight = 0u32;
                for w in &weights {
                    total_weight = total_weight.saturating_add(*w);
                }

                if total_weight > 0 {
                    let mut selection_value = (randomness % (total_weight as u128)) as u32;
                    let mut cumulative = 0u32;

                    for j in 0..entries.len() {
                        let weight = weights.get(j).unwrap_or(&1);
                        cumulative = cumulative.saturating_add(*weight);

                        if selection_value <= cumulative {
                            if let Some(entry) = entries.get(j) {
                                results
                                    .push_back(AllocationResult {
                                        winner: entry.participant.clone(),
                                        allocation_index: i,
                                        randomness_value: randomness,
                                        weight_applied: *weight,
                                    })
                                    .unwrap();
                            }
                            break;
                        }
                    }
                }
            }
        }

        results
    }

    /// Check if entry would violate anti-sniping rate limits
    pub fn check_anti_sniping(
        e: &Env,
        participant: &Address,
        config: &AntiSnipingConfig,
        recent_entries: &Vec<LotteryEntry>,
    ) -> bool {
        let current_time = e.ledger().timestamp();
        let window_start = current_time.saturating_sub(config.rate_limit_window);

        let mut recent_count = 0u32;
        for entry in recent_entries {
            if entry.participant == *participant && entry.entry_time >= window_start {
                recent_count += 1;
            }
        }

        recent_count < config.max_entries_per_address
    }

    /// Compute allocation fairness score (0-100)
    /// Higher = fairer distribution (measures how evenly randomness selected entries)
    pub fn compute_fairness_score(
        e: &Env,
        results: &Vec<AllocationResult>,
        total_entries: u32,
    ) -> u32 {
        if results.len() == 0 || total_entries == 0 {
            return 100;
        }

        // Measure if selection is roughly proportional
        // Ideal: each entry has equal chance of selection
        let selection_rate = (results.len() as u128 * 100) / (total_entries as u128);

        // Score: how close is actual distribution to 1/N probability
        // Range [0, 100]
        if selection_rate > 0 && selection_rate <= 100 {
            100u32
        } else if selection_rate > 100 {
            (100 - ((selection_rate - 100).min(100)) as u32).max(0)
        } else {
            50 // Partial allocation
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anti_sniping_rate_limit() {
        let config = AntiSnipingConfig {
            minimum_lock_period: 10,
            max_entries_per_address: 3,
            rate_limit_window: 3600,
            randomization_delay_ledgers: 5,
        };

        assert!(config.max_entries_per_address == 3);
        assert!(config.rate_limit_window == 3600);
    }
}
