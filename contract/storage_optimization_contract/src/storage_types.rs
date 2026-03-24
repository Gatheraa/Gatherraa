use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

// Optimized storage layout with packed structs and efficient data types
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    // Use packed storage keys for better efficiency
    PackedUserData(Address),
    PackedConfig,
    StorageMetrics,
    CacheData,
    BatchOperations,
}

// Optimized packed user data - using u32 instead of u64 where possible
#[derive(Clone)]
pub struct PackedUserData {
    // Pack multiple fields into single storage slots where possible
    pub user: Address,
    pub flags: u32,        // Bit flags for multiple boolean values
    pub counts: u32,       // Packed counter values
    pub timestamps: u64,  // Single timestamp for multiple purposes
    pub amounts: i128,     // Monetary values
    pub metadata: BytesN<16>, // Fixed-size metadata instead of dynamic
}

// Bit flag definitions for packed flags
pub mod flags {
    pub const ACTIVE: u32 = 1 << 0;
    pub const VERIFIED: u32 = 1 << 1;
    pub const PREMIUM: u32 = 1 << 2;
    pub const SUSPENDED: u32 = 1 << 3;
    pub const FEATURE_A: u32 = 1 << 4;
    pub const FEATURE_B: u32 = 1 << 5;
    pub const FEATURE_C: u32 = 1 << 6;
    pub const FEATURE_D: u32 = 1 << 7;
}

// Packed counter definitions
pub mod counters {
    pub const LOGIN_COUNT_MASK: u32 = 0x0000FFFF;
    pub const TRANSACTION_COUNT_SHIFT: u32 = 16;
    pub const TRANSACTION_COUNT_MASK: u32 = 0xFFFF0000;
}

// Optimized configuration storage
#[derive(Clone)]
pub struct PackedConfig {
    // Pack multiple configuration values
    pub max_users: u32,
    pub fee_rate: u32,      // Basis points (0-10000)
    pub timeout: u32,       // Seconds
    pub limits: u32,        // Packed limit values
    pub thresholds: u64,    // Packed threshold values
    pub admin_address: Address,
}

// Storage metrics for optimization tracking
#[derive(Clone)]
pub struct StorageMetrics {
    pub total_entries: u32,
    pub cache_hits: u32,
    pub cache_misses: u32,
    pub storage_reads: u32,
    pub storage_writes: u32,
    pub gas_used: u64,
    pub last_optimized: u64,
}

// Cache data structure for frequently accessed data
#[derive(Clone)]
pub struct CacheData {
    pub key: BytesN<32>,
    pub value: BytesN<32>,
    pub timestamp: u64,
    pub access_count: u32,
    pub ttl: u32,          // Time to live in seconds
}

// Batch operation structure for reducing transaction costs
#[derive(Clone)]
pub struct BatchOperations {
    pub batch_id: BytesN<32>,
    pub operations: Vec<BatchOperation>,
    pub status: BatchStatus,
    pub created_at: u64,
    pub executed_at: Option<u64>,
}

#[derive(Clone, PartialEq)]
pub enum BatchStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Clone)]
pub struct BatchOperation {
    pub operation_type: u8,    // Use u8 instead of enum for storage efficiency
    pub target: Address,
    pub amount: i128,
    pub data: BytesN<32),
    pub gas_estimate: u32,
}

// Efficient data structures for common patterns
#[derive(Clone)]
pub struct CompactMap {
    pub keys: Vec<BytesN<16)>,  // Smaller keys for storage efficiency
    pub values: Vec<u32>,        // Use u32 instead of larger types where possible
    pub timestamps: Vec<u32>,   // Packed timestamps
}

// Storage layout optimization utilities
#[derive(Clone)]
pub struct StorageOptimizer {
    pub packing_enabled: bool,
    pub cache_enabled: bool,
    pub batch_size: u32,
    pub compression_enabled: bool,
}

// Custom errors for storage optimization
#[derive(Debug, Clone, PartialEq)]
pub enum StorageError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    InvalidData,
    StorageLimitExceeded,
    CacheError,
    BatchError,
    OptimizationFailed,
    InvalidPacking,
    UnpackingError,
    CacheExpired,
    BatchLimitExceeded,
    GasLimitExceeded,
    ContractPaused,
    StorageCorruption,
    SerializationError,
}

// Utility functions for bit operations
pub fn set_flag(flags: &mut u32, flag: u32) {
    *flags |= flag;
}

pub fn clear_flag(flags: &mut u32, flag: u32) {
    *flags &= !flag;
}

pub fn has_flag(flags: u32, flag: u32) -> bool {
    (flags & flag) != 0
}

pub fn pack_counts(login_count: u32, transaction_count: u32) -> u32 {
    (login_count & counters::LOGIN_COUNT_MASK) | 
    ((transaction_count << counters::TRANSACTION_COUNT_SHIFT) & counters::TRANSACTION_COUNT_MASK)
}

pub fn unpack_login_count(packed: u32) -> u32 {
    packed & counters::LOGIN_COUNT_MASK
}

pub fn unpack_transaction_count(packed: u32) -> u32 {
    (packed >> counters::TRANSACTION_COUNT_SHIFT) & (counters::TRANSACTION_COUNT_MASK >> counters::TRANSACTION_COUNT_SHIFT)
}

// Storage layout benchmarks
#[derive(Clone)]
pub struct StorageBenchmark {
    pub operation: Symbol,
    pub gas_before: u64,
    pub gas_after: u64,
    pub storage_before: u32,
    pub storage_after: u32,
    pub improvement_percentage: f32,
}

// Cache strategies
#[derive(Clone, PartialEq)]
pub enum CacheStrategy {
    LRU,           // Least Recently Used
    LFU,           // Least Frequently Used
    TTL,           // Time To Live
    Adaptive,      // Adaptive caching
}

// Compression strategies
#[derive(Clone, PartialEq)]
pub enum CompressionStrategy {
    None,
    RLE,           // Run Length Encoding
    Dictionary,    // Dictionary compression
    Adaptive,      // Adaptive compression
}
