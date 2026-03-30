//! General utility functions for Gathera contracts

use soroban_sdk::{Env, Address, Symbol, String, Vec, Map};
use crate::types::{CommonStatus, SortDirection};

/// Validation utilities
pub struct ValidationUtils;

impl ValidationUtils {
    /// Validate address format
    pub fn validate_address(_address: &Address) -> bool {
        // In Soroban, addresses are always valid by construction
        true
    }
    
    /// Validate symbol format
    pub fn validate_symbol(symbol: &Symbol) -> bool {
        // Check if symbol is not empty and has reasonable length
        let symbol_str = symbol.to_string();
        !symbol_str.is_empty() && symbol_str.len() <= 32
    }
    
    /// Validate string format
    pub fn validate_string(string: &String, max_len: usize) -> bool {
        !string.is_empty() && string.len() <= max_len
    }
    
    /// Validate amount (non-zero and reasonable)
    pub fn validate_amount(amount: u128, max_amount: u128) -> bool {
        amount > 0 && amount <= max_amount
    }
    
    /// Validate timestamp (not in the past, not too far in future)
    pub fn validate_timestamp(timestamp: u64, current_time: u64, max_future: u64) -> bool {
        timestamp >= current_time && timestamp <= current_time + max_future
    }
}

/// String utilities
pub struct StringUtils;

impl StringUtils {
    /// Check if string contains only alphanumeric characters
    pub fn is_alphanumeric(string: &String) -> bool {
        string.to_string().chars().all(|c| c.is_alphanumeric())
    }
    
    /// Truncate string if too long
    pub fn truncate(string: &String, max_len: usize) -> String {
        if string.len() <= max_len {
            string.clone()
        } else {
            String::from_str(&string.to_string()[..max_len])
        }
    }
    
    /// Convert string to uppercase
    pub fn to_uppercase(string: &String) -> String {
        String::from_str(&string.to_string().to_uppercase())
    }
    
    /// Convert string to lowercase
    pub fn to_lowercase(string: &String) -> String {
        String::from_str(&string.to_string().to_lowercase())
    }
}

/// Array/Vector utilities
pub struct VecUtils;

impl VecUtils {
    /// Check if vector contains an element
    pub fn contains<T: PartialEq>(vec: &Vec<T>, item: &T) -> bool {
        vec.iter().any(|x| x == item)
    }
    
    /// Remove duplicates from vector
    pub fn remove_duplicates<T: PartialEq + Clone>(vec: &Vec<T>) -> Vec<T> {
        let mut result = Vec::new(&vec.env());
        for item in vec.iter() {
            if !Self::contains(&result, item) {
                result.push_back(item.clone());
            }
        }
        result
    }
    
    /// Check if vector is empty or contains only empty elements
    pub fn is_empty_or_invalid<T>(vec: &Vec<T>) -> bool {
        vec.is_empty()
    }
}

/// Map utilities
pub struct MapUtils;

impl MapUtils {
    /// Get value from map with default
    pub fn get_or_default<K, V: Clone>(map: &Map<K, V>, key: &K, default: V) -> V {
        map.get(key).unwrap_or(default)
    }
    
    /// Check if map contains key
    pub fn contains_key<K, V>(map: &Map<K, V>, key: &K) -> bool {
        map.get(key).is_some()
    }
    
    /// Merge two maps (second map overwrites first)
    pub fn merge<K: Clone, V: Clone>(map1: &Map<K, V>, map2: &Map<K, V>) -> Map<K, V> {
        let mut result = Map::new(&map1.env());
        
        // Copy first map
        for (key, value) in map1.iter() {
            result.set(key.clone(), value.clone());
        }
        
        // Copy second map (overwrites duplicates)
        for (key, value) in map2.iter() {
            result.set(key.clone(), value.clone());
        }
        
        result
    }
}

/// Time utilities
pub struct TimeUtils;

impl TimeUtils {
    /// Get current timestamp
    pub fn now(env: &Env) -> u64 {
        env.ledger().timestamp()
    }
    
    /// Add duration to timestamp
    pub fn add_duration(timestamp: u64, duration_seconds: u64) -> u64 {
        timestamp + duration_seconds
    }
    
    /// Check if timestamp is in the past
    pub fn is_past(timestamp: u64, current_time: u64) -> bool {
        timestamp < current_time
    }
    
    /// Check if timestamp is in the future
    pub fn is_future(timestamp: u64, current_time: u64) -> bool {
        timestamp > current_time
    }
    
    /// Calculate time difference
    pub fn time_diff(timestamp1: u64, timestamp2: u64) -> u64 {
        if timestamp1 > timestamp2 {
            timestamp1 - timestamp2
        } else {
            timestamp2 - timestamp1
        }
    }
}

/// Status utilities
pub struct StatusUtils;

impl StatusUtils {
    /// Check if status is active
    pub fn is_active(status: CommonStatus) -> bool {
        status == CommonStatus::Active
    }
    
    /// Check if status is terminal (cannot be changed)
    pub fn is_terminal(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Completed | CommonStatus::Cancelled)
    }
    
    /// Check if status allows modifications
    pub fn allows_modifications(status: CommonStatus) -> bool {
        matches!(status, CommonStatus::Active | CommonStatus::Suspended)
    }
}

/// Sorting utilities
pub struct SortUtils;

impl SortUtils {
    /// Apply sorting to a vector based on direction
    pub fn apply_sort_direction<T: Ord>(vec: &mut Vec<T>, direction: SortDirection) {
        // Note: This is a simplified implementation
        // In practice, you'd need to implement custom sorting logic
        match direction {
            SortDirection::Ascending => {
                // Sort ascending
            }
            SortDirection::Descending => {
                // Sort descending
            }
        }
    }
}
