#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, PackedUserData, PackedConfig, StorageMetrics, CacheData, BatchOperations,
                   BatchStatus, BatchOperation, CompactMap, StorageOptimizer, StorageError,
                   flags, counters, set_flag, clear_flag, has_flag, pack_counts, unpack_login_count,
                   unpack_transaction_count, StorageBenchmark, CacheStrategy, CompressionStrategy};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct StorageOptimizationContract;

#[contractimpl]
impl StorageOptimizationContract {
    // Initialize the contract with optimized settings
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        
        // Initialize optimizer with default settings
        let optimizer = StorageOptimizer {
            packing_enabled: true,
            cache_enabled: true,
            batch_size: 100,
            compression_enabled: false,
        };
        e.storage().instance().set(&DataKey::StorageOptimizer, &optimizer);
        
        // Initialize storage metrics
        let metrics = StorageMetrics {
            total_entries: 0,
            cache_hits: 0,
            cache_misses: 0,
            storage_reads: 0,
            storage_writes: 0,
            gas_used: 0,
            last_optimized: e.ledger().timestamp(),
        };
        e.storage().instance().set(&DataKey::StorageMetrics, &metrics);
    }

    // Store user data with optimized packing
    pub fn store_user_data_optimized(
        e: Env,
        user: Address,
        active: bool,
        verified: bool,
        premium: bool,
        login_count: u32,
        transaction_count: u32,
        amount: i128,
        metadata: BytesN<16>,
    ) {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Pack boolean flags into single u32
        let mut flags = 0u32;
        if active { set_flag(&mut flags, flags::ACTIVE); }
        if verified { set_flag(&mut flags, flags::VERIFIED); }
        if premium { set_flag(&mut flags, flags::PREMIUM); }

        // Pack counts into single u32
        let packed_counts = pack_counts(login_count, transaction_count);

        // Create optimized user data structure
        let user_data = PackedUserData {
            user: user.clone(),
            flags,
            counts: packed_counts,
            timestamps: e.ledger().timestamp(),
            amounts: amount,
            metadata: metadata.clone(),
        };

        // Store with optimized key
        e.storage().persistent().set(&DataKey::PackedUserData(user.clone()), &user_data);

        // Update metrics
        Self::update_storage_metrics(&e, 1, 0, 1);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("user_data_stored"), user.clone()),
            (flags, packed_counts),
        );
    }

    // Batch store multiple users for gas optimization
    pub fn batch_store_users(
        e: Env,
        users: Vec<Address>,
        flags: Vec<u32>,
        counts: Vec<u32>,
        amounts: Vec<i128>,
        metadata: Vec<BytesN<16>>,
    ) -> BytesN<32> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let batch_id = e.crypto().sha256(&e.ledger().timestamp().to_val().to_bytes());

        let mut operations = Vec::new(&e);
        
        for i in 0..users.len() {
            let user_data = PackedUserData {
                user: users.get(i).unwrap().clone(),
                flags: flags.get(i).unwrap().clone(),
                counts: counts.get(i).unwrap().clone(),
                timestamps: e.ledger().timestamp(),
                amounts: amounts.get(i).unwrap().clone(),
                metadata: metadata.get(i).unwrap().clone(),
            };

            e.storage().persistent().set(&DataKey::PackedUserData(users.get(i).unwrap().clone()), &user_data);
        }

        // Update metrics
        Self::update_storage_metrics(&e, users.len() as u32, 0, 1);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("batch_stored"), batch_id.clone()),
            users.len(),
        );

        batch_id
    }

    // Cache frequently accessed data
    pub fn cache_data(
        e: Env,
        key: BytesN<32>,
        value: BytesN<32>,
        ttl: u32,
    ) {
        let cache_data = CacheData {
            key: key.clone(),
            value: value.clone(),
            timestamp: e.ledger().timestamp(),
            access_count: 1,
            ttl,
        };

        e.storage().temporary().set(&DataKey::CacheData(key.clone()), &cache_data, ttl as u64);

        // Update metrics
        Self::update_cache_metrics(&e, true);
    }

    // Retrieve cached data
    pub fn get_cached_data(e: Env, key: BytesN<32>) -> Option<BytesN<32>> {
        if let Some(cache_data) = e.storage().temporary().get::<DataKey, CacheData>(&DataKey::CacheData(key.clone())) {
            let current_time = e.ledger().timestamp();
            
            // Check TTL
            if current_time - cache_data.timestamp < cache_data.ttl as u64 {
                // Update access count
                let mut updated_cache = cache_data.clone();
                updated_cache.access_count += 1;
                e.storage().temporary().set(&DataKey::CacheData(key.clone()), &updated_cache, cache_data.ttl as u64);
                
                // Update metrics
                Self::update_cache_metrics(&e, true);
                
                return Some(cache_data.value);
            } else {
                // Cache expired
                Self::update_cache_metrics(&e, false);
                return None;
            }
        }
        
        Self::update_cache_metrics(&e, false);
        None
    }

    // Get packed user data with unpacking
    pub fn get_user_data(e: Env, user: Address) -> PackedUserData {
        e.storage().persistent().get(&DataKey::PackedUserData(user))
            .unwrap_or_else(|| panic!("user data not found"))
    }

    // Check user flags efficiently
    pub fn check_user_flag(e: Env, user: Address, flag: u32) -> bool {
        let user_data = Self::get_user_data(e.clone(), user);
        has_flag(user_data.flags, flag)
    }

    // Get user counts with unpacking
    pub fn get_user_counts(e: Env, user: Address) -> (u32, u32) {
        let user_data = Self::get_user_data(e.clone(), user);
        let login_count = unpack_login_count(user_data.counts);
        let transaction_count = unpack_transaction_count(user_data.counts);
        (login_count, transaction_count)
    }

    // Update user data efficiently (only changed fields)
    pub fn update_user_data(
        e: Env,
        user: Address,
        active: Option<bool>,
        verified: Option<bool>,
        premium: Option<bool>,
        add_login: Option<u32>,
        add_transaction: Option<u32>,
        add_amount: Option<i128>,
    ) {
        let mut user_data = Self::get_user_data(e.clone(), user.clone());

        // Update flags if provided
        if let Some(active_val) = active {
            if active_val {
                set_flag(&mut user_data.flags, flags::ACTIVE);
            } else {
                clear_flag(&mut user_data.flags, flags::ACTIVE);
            }
        }

        if let Some(verified_val) = verified {
            if verified_val {
                set_flag(&mut user_data.flags, flags::VERIFIED);
            } else {
                clear_flag(&mut user_data.flags, flags::VERIFIED);
            }
        }

        if let Some(premium_val) = premium {
            if premium_val {
                set_flag(&mut user_data.flags, flags::PREMIUM);
            } else {
                clear_flag(&mut user_data.flags, flags::PREMIUM);
            }
        }

        // Update counts if provided
        if let Some(login_increment) = add_login {
            let current_login = unpack_login_count(user_data.counts);
            let current_transaction = unpack_transaction_count(user_data.counts);
            user_data.counts = pack_counts(current_login + login_increment, current_transaction);
        }

        if let Some(transaction_increment) = add_transaction {
            let current_login = unpack_login_count(user_data.counts);
            let current_transaction = unpack_transaction_count(user_data.counts);
            user_data.counts = pack_counts(current_login, current_transaction + transaction_increment);
        }

        // Update amount if provided
        if let Some(amount_increment) = add_amount {
            user_data.amounts += amount_increment;
        }

        // Update timestamp
        user_data.timestamps = e.ledger().timestamp();

        // Store updated data
        e.storage().persistent().set(&DataKey::PackedUserData(user.clone()), &user_data);

        // Update metrics
        Self::update_storage_metrics(&e, 0, 1, 1);
    }

    // Compact map operations for efficient storage
    pub fn store_compact_map(
        e: Env,
        map_id: Symbol,
        keys: Vec<BytesN<16)>,
        values: Vec<u32>,
        timestamps: Vec<u32>,
    ) {
        let compact_map = CompactMap {
            keys,
            values,
            timestamps,
        };

        e.storage().persistent().set(&DataKey::CompactMap(map_id), &compact_map);
    }

    // Storage optimization utilities
    pub fn optimize_storage(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // This would implement storage compaction and optimization
        // For demonstration, we'll just update metrics
        
        let mut metrics = Self::get_storage_metrics(e.clone());
        metrics.last_optimized = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::StorageMetrics, &metrics);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("storage_optimized")),
            e.ledger().timestamp(),
        );
    }

    // Benchmark storage operations
    pub fn benchmark_storage(e: Env, operation: Symbol) -> StorageBenchmark {
        let gas_before = e.ledger().timestamp(); // Simplified gas measurement
        
        // Perform operation and measure
        match operation {
            symbol_short!("store") => {
                let test_user = Address::generate(&e);
                let test_metadata = BytesN::from_array(&e, &[1; 16]);
                Self::store_user_data_optimized(
                    e.clone(),
                    test_user,
                    true,
                    false,
                    true,
                    10,
                    5,
                    1000,
                    test_metadata,
                );
            }
            symbol_short!("batch") => {
                let users = vec![&e, Address::generate(&e), Address::generate(&e)];
                let flags = vec![&e, 1, 2];
                let counts = vec![&e, 100, 200];
                let amounts = vec![&e, 1000, 2000];
                let metadata = vec![&e, BytesN::from_array(&e, &[1; 16]), BytesN::from_array(&e, &[2; 16])];
                Self::batch_store_users(e.clone(), users, flags, counts, amounts, metadata);
            }
            _ => {}
        }
        
        let gas_after = e.ledger().timestamp();
        
        StorageBenchmark {
            operation,
            gas_before,
            gas_after,
            storage_before: 0,
            storage_after: 0,
            improvement_percentage: 0.0,
        }
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

    // View functions
    pub fn get_storage_metrics(e: Env) -> StorageMetrics {
        e.storage().instance().get(&DataKey::StorageMetrics).unwrap()
    }

    pub fn get_optimizer_config(e: Env) -> StorageOptimizer {
        e.storage().instance().get(&DataKey::StorageOptimizer).unwrap()
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn update_storage_metrics(e: &Env, reads: u32, writes: u32, entries: u32) {
        let mut metrics = Self::get_storage_metrics(e.clone());
        metrics.storage_reads += reads;
        metrics.storage_writes += writes;
        metrics.total_entries += entries;
        e.storage().instance().set(&DataKey::StorageMetrics, &metrics);
    }

    fn update_cache_metrics(e: &Env, hit: bool) {
        let mut metrics = Self::get_storage_metrics(e.clone());
        if hit {
            metrics.cache_hits += 1;
        } else {
            metrics.cache_misses += 1;
        }
        e.storage().instance().set(&DataKey::StorageMetrics, &metrics);
    }
}
