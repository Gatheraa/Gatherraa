use soroban_sdk::{contracttype, contracterror, Address, BytesN, Env, Symbol, Vec, Map, U256, Bytes};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    BatchData,
    PaginationState,
    GasMetrics,
    LoopConfig,
    IteratorState,
}

// Batch processing structure for large datasets
#[derive(Clone)]
#[contracttype]
pub struct BatchData {
    pub batch_id: BytesN<32>,
    pub total_items: u32,
    pub processed_items: u32,
    pub batch_size: u32,
    pub current_batch: u32,
    pub status: BatchStatus,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub gas_used_per_batch: u64,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum BatchStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Paused,
}

// Pagination state for large datasets
#[derive(Clone)]
#[contracttype]
pub struct PaginationState {
    pub pagination_id: BytesN<32>,
    pub total_items: u32,
    pub page_size: u32,
    pub current_page: u32,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_previous: bool,
    pub cursor: Option<BytesN<32>>,
    pub created_at: u64,
}

// Gas usage metrics for monitoring
#[derive(Clone)]
#[contracttype]
pub struct GasMetrics {
    pub operation_id: BytesN<32>,
    pub operation_type: Symbol,
    pub gas_limit: u64,
    pub gas_used: u64,
    pub gas_remaining: u64,
    pub iterations_completed: u32,
    pub total_iterations: u32,
    pub gas_per_iteration: u64,
    pub timestamp: u64,
}

// Loop configuration for safe iteration
#[derive(Clone)]
#[contracttype]
pub struct LoopConfig {
    pub max_iterations: u32,
    pub gas_limit_per_iteration: u64,
    pub total_gas_limit: u64,
    pub batch_size: u32,
    pub pagination_enabled: bool,
    pub gas_monitoring_enabled: bool,
    pub auto_break_on_gas_limit: bool,
}

// Iterator state for resumable operations
#[derive(Clone)]
#[contracttype]
pub struct IteratorState {
    pub iterator_id: BytesN<32>,
    pub current_position: u32,
    pub total_items: u32,
    pub items_processed: u32,
    pub gas_used: u64,
    pub last_checkpoint: u64,
    pub checkpoint_data: Bytes,
    pub status: IteratorStatus,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum IteratorStatus {
    Active,
    Paused,
    Completed,
    Failed,
    Resumable,
}

// Custom errors for iteration optimization
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum IterationError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    GasLimitExceeded = 4,
    IterationLimitExceeded = 5,
    BatchNotFound = 6,
    PaginationError = 7,
    IteratorNotFound = 8,
    InvalidBatchSize = 9,
    InvalidPageSize = 10,
    InvalidGasLimit = 11,
    InvalidLoopConfig = 12,
    IteratorCorrupted = 13,
    CheckpointFailed = 14,
    ResumeFailed = 15,
    BatchProcessingFailed = 16,
    ContractPaused = 17,
    StorageError = 18,
    SerializationError = 19,
}

// Gas monitoring utilities
#[derive(Clone)]
#[contracttype]
pub struct GasMonitor {
    pub initial_gas: u64,
    pub current_gas: u64,
    pub gas_limit: u64,
    pub warning_threshold: u32,
    pub critical_threshold: u32,
}

// Batch processor configuration
#[derive(Clone)]
#[contracttype]
pub struct BatchProcessor {
    pub processor_id: Address,
    pub max_batch_size: u32,
    pub preferred_batch_size: u32,
    pub gas_threshold: u64,
    pub retry_limit: u32,
    pub retry_delay: u64,
}

// Pagination cursor for efficient data access
#[derive(Clone)]
#[contracttype]
pub struct PaginationCursor {
    pub cursor_id: BytesN<32>,
    pub position: u32,
    pub page_size: u32,
    pub sort_field: Symbol,
    pub sort_direction: SortDirection,
    pub filters: Vec<FilterCondition>,
    pub created_at: u64,
    pub expires_at: u64,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Clone)]
#[contracttype]
pub struct FilterCondition {
    pub field: Symbol,
    pub operator: ComparisonOperator,
    pub value: soroban_sdk::Val,
}

#[derive(Clone, PartialEq)]
#[contracttype]
pub enum ComparisonOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    GreaterThanOrEqual,
    LessThanOrEqual,
    Contains,
    NotContains,
    In,
    NotIn,
}

// Loop optimization strategies
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum OptimizationStrategy {
    NoOptimization,
    BatchProcessing,
    Pagination,
    GasMonitoring,
    Combined,
}

// Performance metrics
#[derive(Clone)]
#[contracttype]
pub struct PerformanceMetrics {
    pub total_operations: u32,
    pub successful_operations: u32,
    pub failed_operations: u32,
    pub average_gas_per_operation: u64,
    pub avg_iterations_per_op: u32,
    pub total_gas_saved: u64,
    pub optimization_improvement: u32,
    pub last_updated: u64,
}
