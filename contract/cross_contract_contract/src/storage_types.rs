use soroban_sdk::{Address, BytesN, Env, Symbol, Vec, Map, U256};

#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    Version,
    ContractRegistry,
    ContractPermissions,
    AtomicOperation,
    CallbackRegistry,
    DependencyGraph,
    OperationQueue,
}

#[derive(Clone)]
pub struct ContractRegistry {
    pub contracts: Map<Address, ContractInfo>,
    pub contract_types: Map<Symbol, Address>,
    pub contract_versions: Map<Address, u32>,
}

#[derive(Clone)]
pub struct ContractInfo {
    pub address: Address,
    pub contract_type: Symbol,
    pub version: u32,
    pub active: bool,
    pub permissions: ContractPermissions,
    pub dependencies: Vec<Address>,
    pub registered_at: u64,
}

#[derive(Clone)]
pub struct ContractPermissions {
    pub can_call: Vec<Address>,
    pub can_be_called_by: Vec<Address>,
    pub requires_auth: bool,
    pub delegate_auth_to: Vec<Address>,
}

#[derive(Clone)]
pub struct AtomicOperation {
    pub id: BytesN<32>,
    pub operations: Vec<ContractCall>,
    pub status: OperationStatus,
    pub created_at: u64,
    pub timeout: u64,
    pub rollback_data: Vec<RollbackData>,
    pub caller: Address,
}

#[derive(Clone)]
pub struct ContractCall {
    pub contract_address: Address,
    pub function_name: Symbol,
    pub arguments: Vec<soroban_sdk::Val>,
    pub value: Option<i128>,
    pub requires_success: bool,
}

#[derive(Clone, PartialEq)]
pub enum OperationStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    RolledBack,
}

#[derive(Clone)]
pub struct RollbackData {
    pub contract_address: Address,
    pub rollback_function: Symbol,
    pub rollback_arguments: Vec<soroban_sdk::Val>,
}

#[derive(Clone)]
pub struct CallbackRegistry {
    pub callbacks: Map<BytesN<32>, Callback>,
    pub active_callbacks: Vec<BytesN<32>>,
}

#[derive(Clone)]
pub struct Callback {
    pub id: BytesN<32>,
    pub trigger_contract: Address,
    pub trigger_function: Symbol,
    pub callback_contract: Address,
    pub callback_function: Symbol,
    pub callback_data: Vec<soroban_sdk::Val>,
    pub active: bool,
    pub created_at: u64,
}

#[derive(Clone)]
pub struct DependencyGraph {
    pub nodes: Map<Address, DependencyNode>,
    pub edges: Vec<DependencyEdge>,
}

#[derive(Clone)]
pub struct DependencyNode {
    pub contract_address: Address,
    pub contract_type: Symbol,
    pub dependents: Vec<Address>,
    pub dependencies: Vec<Address>,
    pub circular_dependency: bool,
}

#[derive(Clone)]
pub struct DependencyEdge {
    pub from: Address,
    pub to: Address,
    pub dependency_type: DependencyType,
}

#[derive(Clone)]
pub enum DependencyType {
    Required,
    Optional,
    Weak,
}

#[derive(Clone)]
pub struct OperationQueue {
    pub pending_operations: Vec<BytesN<32>>,
    pub processing_operations: Vec<BytesN<32>>,
    pub completed_operations: Vec<BytesN<32>>,
    pub failed_operations: Vec<BytesN<32>>,
}

#[derive(Clone)]
pub struct ContractState {
    pub contract_address: Address,
    pub state_hash: BytesN<32>,
    pub last_updated: u64,
    pub version: u32,
}

// Custom errors
#[derive(Debug, Clone, PartialEq)]
pub enum CrossContractError {
    AlreadyInitialized,
    NotInitialized,
    Unauthorized,
    ContractNotFound,
    InvalidContractType,
    PermissionDenied,
    CircularDependency,
    OperationNotFound,
    InvalidOperation,
    OperationTimeout,
    RollbackFailed,
    CallbackNotFound,
    InvalidCallback,
    DependencyNotFound,
    StateSyncFailed,
    AtomicOperationFailed,
    InvalidArguments,
    InsufficientBalance,
    TransferFailed,
    ContractPaused,
    VersionMismatch,
    InvalidAddress,
    DuplicateRegistration,
    InvalidDependency,
    CallbackExecutionFailed,
}
