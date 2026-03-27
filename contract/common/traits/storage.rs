//! Storage traits for Gatheraa contracts
//! 
//! This module defines common storage interfaces and patterns to ensure
//! consistent and efficient storage management across all contracts.

use soroban_sdk::{Env, Map, Vec};

/// Trait for storage key management
pub trait StorageKey {
    /// Get the storage key for a given identifier
    fn get_key(&self) -> Vec<u8>;
    
    /// Get a namespace-prefixed key
    fn get_namespaced_key(&self, namespace: &Symbol) -> Vec<u8>;
}

/// Trait for batch storage operations
pub trait BatchStorage {
    /// Store multiple key-value pairs atomically
    fn batch_store(&self, env: &Env, entries: Map<StorageKey, Vec<u8>>);
    
    /// Retrieve multiple values by keys
    fn batch_get(&self, env: &Env, keys: Vec<StorageKey>) -> Map<StorageKey, Vec<u8>>;
    
    /// Delete multiple keys
    fn batch_delete(&self, env: &Env, keys: Vec<StorageKey>);
}

/// Trait for storage migration
pub trait StorageMigration {
    /// Migrate storage from one version to another
    fn migrate(&self, env: &Env, from_version: u32, to_version: u32) -> Result<(), crate::error::Error>;
    
    /// Validate storage integrity after migration
    fn validate_migration(&self, env: &Env) -> Result<(), crate::error::Error>;
}

/// Trait for storage optimization
pub trait StorageOptimizer {
    /// Optimize storage layout for gas efficiency
    fn optimize(&self, env: &Env);
    
    /// Compact storage to remove unused space
    fn compact(&self, env: &Env);
    
    /// Get storage usage statistics
    fn get_usage_stats(&self, env: &Env) -> StorageStats;
}

/// Storage usage statistics
#[derive(Clone, Debug)]
pub struct StorageStats {
    pub total_entries: u32,
    pub total_size: u32,
    pub optimized_entries: u32,
    pub fragmentation_ratio: u32,
}
