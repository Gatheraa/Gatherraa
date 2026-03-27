use soroban_sdk::{contracttype, Address, BytesN, Env, Symbol, Vec, Map, U256};

/// Storage keys for the Cross-Contract Orchestrator.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The global administrator address.
    Admin,
    /// Boolean flag indicating if the contract is paused.
    Paused,
    /// Logic version of the orchestrator.
    Version,
    /// Registry of all known contracts and their metadata.
    ContractRegistry,
    /// Permissions mapping between contracts.
    ContractPermissions,
    /// Information about a specific atomic multi-call operation.
    AtomicOperation(BytesN<32>),
    /// Registry for asynchronous callbacks.
    CallbackRegistry,
    /// Graph representing inter-contract dependencies.
    DependencyGraph,
    /// Queue for processing multi-step operations.
    OperationQueue,
}

/// Stores metadata about registered contracts in the ecosystem.
#[contracttype]
#[derive(Clone)]
pub struct ContractRegistry {
    /// Mapping from contract address to detailed info.
    pub contracts: Map<Address, ContractInfo>,
    /// Mapping from symbolic type (e.g., 'TOKEN') to its canonical address.
    pub contract_types: Map<Symbol, Address>,
    /// Tracking of current deployed versions for each address.
    pub contract_versions: Map<Address, u32>,
}

/// Detailed information about a registered contract.
#[contracttype]
#[derive(Clone)]
pub struct ContractInfo {
    /// The address of the contract.
    pub address: Address,
    /// The logical category of the contract.
    pub contract_type: Symbol,
    /// Semantic version of the contract logic.
    pub version: u32,
    /// Whether the contract is currently active in the registry.
    pub active: bool,
    /// Access control rules for this contract.
    pub permissions: ContractPermissions,
    /// List of other contracts this contract depends on.
    pub dependencies: Vec<Address>,
    /// Timestamp when the contract was registered.
    pub registered_at: u64,
}

/// Access control configuration for inter-contract calls.
#[contracttype]
#[derive(Clone)]
pub struct ContractPermissions {
    /// Addresses this contract is allowed to call.
    pub can_call: Vec<Address>,
    /// Addresses allowed to call this contract.
    pub can_be_called_by: Vec<Address>,
    /// Whether calls to this contract require explicit authorization.
    pub requires_auth: bool,
    /// List of addresses that can authoritatively act on behalf of this contract.
    pub delegate_auth_to: Vec<Address>,
}

/// Represents an atomic sequence of contract calls (all-or-nothing).
#[contracttype]
#[derive(Clone)]
pub struct AtomicOperation {
    /// Unique identifier for the operation.
    pub id: BytesN<32>,
    /// Ordered list of calls to execute.
    pub operations: Vec<ContractCall>,
    /// Current execution state.
    pub status: OperationStatus,
    /// Timestamp when the operation was initiated.
    pub created_at: u64,
    /// Expiration time for the operation.
    pub timeout: u64,
    /// Instructions for rolling back changes if a subsequent call fails.
    pub rollback_data: Vec<RollbackData>,
    /// Address that initiated the atomic operation.
    pub caller: Address,
}

/// Definition of a single contract call within an atomic operation.
#[contracttype]
#[derive(Clone)]
pub struct ContractCall {
    /// Target contract address.
    pub contract_address: Address,
    /// Name of the function to invoke.
    pub function_name: Symbol,
    /// Arguments to pass to the function.
    pub arguments: Vec<soroban_sdk::Val>,
    /// Optional amount of native tokens to send (if applicable).
    pub value: Option<i128>,
    /// If true, failure of this call triggers a rollback of the whole operation.
    pub requires_success: bool,
}

/// Possible states of an atomic operation.
#[contracttype]
#[derive(Clone, PartialEq)]
pub enum OperationStatus {
    /// Operation is queued but not yet started.
    Pending,
    /// Currently executing the call sequence.
    InProgress,
    /// All calls finished successfully.
    Completed,
    /// One or more calls failed.
    Failed,
    /// Reversion logic was executed after failure.
    RolledBack,
}

/// Instructions for undoing a contract call.
#[contracttype]
#[derive(Clone)]
pub struct RollbackData {
    /// Contract to call for rollback.
    pub contract_address: Address,
    /// Function that reverts the state change.
    pub rollback_function: Symbol,
    /// Arguments for the rollback function.
    pub rollback_arguments: Vec<soroban_sdk::Val>,
}

/// Registry for managing cross-contract callbacks.
#[contracttype]
#[derive(Clone)]
pub struct CallbackRegistry {
    /// Mapping from callback ID to details.
    pub callbacks: Map<BytesN<32>, Callback>,
    /// List of IDs currently awaiting triggers.
    pub active_callbacks: Vec<BytesN<32>>,
}

/// Definition of an automated response to a contract event/call.
#[contracttype]
#[derive(Clone)]
pub struct Callback {
    /// Unique ID for the callback.
    pub id: BytesN<32>,
    /// Address that triggers the callback.
    pub trigger_contract: Address,
    /// Function that, when finished, triggers this response.
    pub trigger_function: Symbol,
    /// Address to be called in response.
    pub callback_contract: Address,
    /// Function to invoke on the callback contract.
    pub callback_function: Symbol,
    /// Data to pass to the callback function.
    pub callback_data: Vec<soroban_sdk::Val>,
    /// Whether the callback is enabled.
    pub active: bool,
    /// Timestamp when the callback was registered.
    pub created_at: u64,
}

/// Graph structure representing contract dependencies.
#[contracttype]
#[derive(Clone)]
pub struct DependencyGraph {
    /// Nodes representing individual contracts.
    pub nodes: Map<Address, DependencyNode>,
    /// Edges representing dependency links.
    pub edges: Vec<DependencyEdge>,
}

/// A node in the dependency graph.
#[contracttype]
#[derive(Clone)]
pub struct DependencyNode {
    /// The contract's address.
    pub contract_address: Address,
    /// The type of the contract.
    pub contract_type: Symbol,
    /// Contracts that depend on this one.
    pub dependents: Vec<Address>,
    /// Contracts this one depends on.
    pub dependencies: Vec<Address>,
    /// Flag indicating if this node is part of a circular loop.
    pub circular_dependency: bool,
}

/// A link between two contracts in the dependency graph.
#[contracttype]
#[derive(Clone)]
pub struct DependencyEdge {
    /// Dependent contract.
    pub from: Address,
    /// Subject contract.
    pub to: Address,
    /// The nature of the dependency.
    pub dependency_type: DependencyType,
}

/// Severity/Requirement level of a dependency.
#[contracttype]
#[derive(Clone)]
pub enum DependencyType {
    /// Must exist and be active.
    Required,
    /// Influences behavior if present.
    Optional,
    /// External reference only.
    Weak,
}

/// Queues for tracking operations through various stages.
#[contracttype]
#[derive(Clone)]
pub struct OperationQueue {
    pub pending_operations: Vec<BytesN<32>>,
    pub processing_operations: Vec<BytesN<32>>,
    pub completed_operations: Vec<BytesN<32>>,
    pub failed_operations: Vec<BytesN<32>>,
}

/// Snapshot of a contract's state for synchronization.
#[contracttype]
#[derive(Clone)]
pub struct ContractState {
    pub contract_address: Address,
    pub state_hash: BytesN<32>,
    pub last_updated: u64,
    pub version: u32,
}

/// Standard error set for the Cross-Contract Orchestrator.
#[soroban_sdk::contracterror]
#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CrossContractError {
    /// Orchestrator is already initialized.
    AlreadyInitialized = 700,
    /// Initialization is required before use.
    NotInitialized = 701,
    /// Unauthorized caller.
    Unauthorized = 702,
    /// Contract not found in registry.
    ContractNotFound = 703,
    /// Provided contract type is invalid.
    InvalidContractType = 704,
    /// Insufficient permissions for call.
    PermissionDenied = 705,
    /// Circular dependency detected in graph.
    CircularDependency = 706,
    /// Atomic operation ID not found.
    OperationNotFound = 707,
    /// Operation parameters are invalid.
    InvalidOperation = 708,
    /// Operation exceeded execution time limit.
    OperationTimeout = 709,
    /// Failure during rollback execution.
    RollbackFailed = 710,
    /// Callback ID not found.
    CallbackNotFound = 711,
    /// Callback configuration is invalid.
    InvalidCallback = 712,
    /// Dependency record not found.
    DependencyNotFound = 713,
    /// Failed to synchronize state between contracts.
    StateSyncFailed = 714,
    /// One of the calls in the atomic operation failed.
    AtomicOperationFailed = 715,
    /// Invalid function arguments provided.
    InvalidArguments = 716,
    /// Insufficient balance for token operation.
    InsufficientBalance = 717,
    /// External token transfer failed.
    TransferFailed = 718,
    /// Orchestrator is currently paused.
    ContractPaused = 719,
    /// Mismatch between expected and actual contract version.
    VersionMismatch = 720,
    /// Invalid address provided.
    InvalidAddress = 721,
    /// Contract already registered in system.
    DuplicateRegistration = 722,
    /// Dependency cannot be satisfied.
    InvalidDependency = 723,
    /// Execution of a callback function failed.
    CallbackExecutionFailed = 724,
}
