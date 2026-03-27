#![no_std]
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, ContractRegistry, ContractInfo, ContractPermissions, AtomicOperation, 
                   ContractCall, OperationStatus, RollbackData, CallbackRegistry, Callback, 
                   DependencyGraph, DependencyNode, DependencyEdge, DependencyType, OperationQueue,
                   ContractState, CrossContractError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, Address, BytesN, Env, IntoVal, Symbol, Vec, Map,
};

#[contract]
pub struct CrossContractContract;

/// The Cross-Contract Orchestrator manages complex interactions between multiple contracts.
///
/// It provides a centralized registry for contract discovery, handles atomic multi-call operations
/// (all-or-nothing), manages contract dependencies to prevent circular loops, and implements a
/// callback system for asynchronous-like behavior in Soroban.
#[contractimpl]
impl CrossContractContract {
    /// Initializes the orchestrator and all its registries.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `admin` - The global administrator address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Version, &1u32);
        
        let registry = ContractRegistry {
            contracts: Map::new(&env),
            contract_types: Map::new(&env),
            contract_versions: Map::new(&env),
        };
        env.storage().instance().set(&DataKey::ContractRegistry, &registry);
        
        let callback_registry = CallbackRegistry {
            callbacks: Map::new(&env),
            active_callbacks: Vec::new(&env),
        };
        env.storage().instance().set(&DataKey::CallbackRegistry, &callback_registry);
        
        let dependency_graph = DependencyGraph {
            nodes: Map::new(&env),
            edges: Vec::new(&env),
        };
        env.storage().instance().set(&DataKey::DependencyGraph, &dependency_graph);
        
        let operation_queue = OperationQueue {
            pending_operations: Vec::new(&env),
            processing_operations: Vec::new(&env),
            completed_operations: Vec::new(&env),
            failed_operations: Vec::new(&env),
        };
        env.storage().instance().set(&DataKey::OperationQueue, &operation_queue);
    }

    /// Registers a contract in the ecosystem and configures its permissions.
    ///
    /// # Arguments
    /// * `contract_address` - The address of the contract to register.
    /// * `contract_type` - Symbolic category for discovery.
    /// * `version` - Version of the contract.
    /// * `permissions` - Access control rules for cross-contract interactions.
    /// * `dependencies` - List of contracts this one depends on.
    ///
    /// # Errors
    /// Returns [CrossContractError::CircularDependency] if the new registration creates a loop.
    pub fn register_contract(
        env: Env,
        contract_address: Address,
        contract_type: Symbol,
        version: u32,
        permissions: ContractPermissions,
        dependencies: Vec<Address>,
    ) -> Result<(), CrossContractError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Check for circular dependencies
        Self::check_circular_dependencies(&env, &contract_address, &dependencies)?;

        let contract_info = ContractInfo {
            address: contract_address.clone(),
            contract_type: contract_type.clone(),
            version,
            active: true,
            permissions: permissions.clone(),
            dependencies: dependencies.clone(),
            registered_at: env.ledger().timestamp(),
        };

        // Update registry
        let mut registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.set(contract_address.clone(), contract_info.clone());
        registry.contract_types.set(contract_type.clone(), contract_address.clone());
        registry.contract_versions.set(contract_address.clone(), version);
        env.storage().instance().set(&DataKey::ContractRegistry, &registry);

        // Update dependency graph
        Self::update_dependency_graph(&env, &contract_address, &contract_type, &dependencies);

        // Store permissions
        env.storage().instance().set(&DataKey::ContractPermissions, &permissions);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("contract_registered"), contract_address.clone()),
            (contract_type, version),
        );

        Ok(())
    }

    // Execute single contract call
    pub fn call_contract(
        env: Env,
        contract_address: Address,
        function_name: Symbol,
        arguments: Vec<soroban_sdk::Val>,
        _value: Option<i128>,
    ) -> Result<soroban_sdk::Val, CrossContractError> {
        let caller = env.current_contract_address();
        
        // Check permissions
        Self::check_call_permissions(&env, &caller, &contract_address)?;

        let contract_info = Self::get_contract_info(&env, &contract_address)?;
        
        // Check if contract is active
        if !contract_info.active {
            panic!("contract is not active");
        }

        // Execute call
        let result = env.invoke_contract::<soroban_sdk::Val>(
            &contract_address,
            &function_name,
            arguments,
        );

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("contract_called"), contract_address.clone()),
            (function_name, caller),
        );

        Ok(result)
    }

    /// Executes a sequence of contract calls atomically.
    ///
    /// If any call marked with `requires_success` fails, all previous calls in the sequence
    /// will be rolled back using their registered rollback functions.
    ///
    /// # Arguments
    /// * `operations` - Vector of contract calls to execute.
    /// * `timeout` - Seconds after which the operation is considered failed if not complete.
    ///
    /// # Returns
    /// Unique ID for the atomic operation.
    pub fn execute_atomic_operation(
        env: Env,
        operations: Vec<ContractCall>,
        timeout: u64,
    ) -> Result<BytesN<32>, CrossContractError> {
        let caller = env.current_contract_address();
        
        let operation_id = Self::generate_operation_id(&env, &caller, &operations);
        
        let atomic_op = AtomicOperation {
            id: operation_id.clone(),
            operations: operations.clone(),
            status: OperationStatus::Pending,
            created_at: env.ledger().timestamp(),
            timeout,
            rollback_data: Vec::new(&env),
            caller: caller.clone(),
        };

        env.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
        
        let mut queue: OperationQueue = env.storage().instance().get(&DataKey::OperationQueue).unwrap();
        queue.pending_operations.push_back(operation_id.clone());
        env.storage().instance().set(&DataKey::OperationQueue, &queue);

        Self::execute_operations(&env, operation_id.clone())?;

        Ok(operation_id)
    }

    // Register callback
    pub fn register_callback(
        env: Env,
        trigger_contract: Address,
        trigger_function: Symbol,
        callback_contract: Address,
        callback_function: Symbol,
        callback_data: Vec<soroban_sdk::Val>,
    ) -> BytesN<32> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let callback_id = Self::generate_callback_id(&env, &trigger_contract, &trigger_function);
        
        let callback = Callback {
            id: callback_id.clone(),
            trigger_contract: trigger_contract.clone(),
            trigger_function: trigger_function.clone(),
            callback_contract: callback_contract.clone(),
            callback_function: callback_function.clone(),
            callback_data: callback_data.clone(),
            active: true,
            created_at: env.ledger().timestamp(),
        };

        // Store callback
        let mut registry: CallbackRegistry = env.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        registry.callbacks.set(callback_id.clone(), callback.clone());
        registry.active_callbacks.push_back(callback_id.clone());
        env.storage().instance().set(&DataKey::CallbackRegistry, &registry);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("callback_registered"), callback_id.clone()),
            (trigger_contract, trigger_function),
        );

        callback_id
    }

    // Trigger callback
    pub fn trigger_callback(env: Env, trigger_contract: Address, trigger_function: Symbol, trigger_data: Vec<soroban_sdk::Val>) {
        let registry: CallbackRegistry = env.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        
        // Find matching callbacks
        let mut callbacks_to_execute = Vec::new(&env);
        for callback_id in registry.active_callbacks.iter() {
            if let Some(callback) = registry.callbacks.get(callback_id) {
                if callback.trigger_contract == trigger_contract && callback.trigger_function == trigger_function {
                    callbacks_to_execute.push_back(callback.clone());
                }
            }
        }

        // Execute callbacks
        for callback in callbacks_to_execute.iter() {
            if callback.active {
                let mut callback_args = callback.callback_data.clone();
                callback_args.extend(trigger_data.clone());
                
                // Execute callback
                let _result = env.invoke_contract::<soroban_sdk::Val>(
                    &callback.callback_contract,
                    &callback.callback_function,
                    callback_args,
                );

                #[allow(deprecated)]
                env.events().publish(
                    (symbol_short!("callback_executed"), callback.id.clone()),
                    (trigger_contract, trigger_function),
                );
            }
        }
    }

    // Sync contract state
    pub fn sync_contract_state(env: Env, contract_address: Address, state_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let contract_info = Self::get_contract_info(&env, &contract_address)?;
        
        let state = ContractState {
            contract_address: contract_address.clone(),
            state_hash: state_hash.clone(),
            last_updated: env.ledger().timestamp(),
            version: contract_info.version,
        };

        // Store state
        env.storage().persistent().set(&contract_address, &state);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("state_synced"), contract_address.clone()),
            state_hash,
        );
    }

    // Verify ticket purchase across contracts
    pub fn verify_ticket_purchase(
        env: Env,
        event_contract: Address,
        ticket_contract: Address,
        purchaser: Address,
        ticket_id: u32,
    ) -> bool {
        // Check ticket contract for ticket ownership
        let ticket_owner_result = env.invoke_contract::<Address>(
            &ticket_contract,
            &symbol_short!("owner_of"),
            vec![&env, ticket_id.into_val(&env)],
        );

        if ticket_owner_result != purchaser {
            return false;
        }

        // Check event contract for ticket validity
        let ticket_valid_result = env.invoke_contract::<bool>(
            &event_contract,
            &symbol_short!("is_ticket_valid"),
            vec![&env, ticket_id.into_val(&env)],
        );

        ticket_valid_result
    }

    // Delegate authorization
    pub fn delegate_authorization(env: Env, from_contract: Address, to_contract: Address, permissions: Vec<Symbol>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Update contract permissions
        let mut registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
        if let Some(mut contract_info) = registry.contracts.get(from_contract.clone()) {
            for _permission in permissions.iter() {
                contract_info.permissions.delegate_auth_to.push_back(to_contract.clone());
            }
            registry.contracts.set(from_contract.clone(), contract_info);
        }

        env.storage().instance().set(&DataKey::ContractRegistry, &registry);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("auth_delegated"), from_contract.clone()),
            to_contract,
        );
    }

    // Admin functions
    pub fn pause(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn deactivate_contract(env: Env, contract_address: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
        if let Some(mut contract_info) = registry.contracts.get(contract_address.clone()) {
            contract_info.active = false;
            registry.contracts.set(contract_address.clone(), contract_info);
        }

        env.storage().instance().set(&DataKey::ContractRegistry, &registry);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("contract_deactivated"), contract_address.clone()),
            (),
        );
    }

    // View functions
    pub fn get_contract_info(env: Env, contract_address: Address) -> Option<ContractInfo> {
        let registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.get(contract_address)
    }

    pub fn get_contract_by_type(env: Env, contract_type: Symbol) -> Option<Address> {
        let registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contract_types.get(contract_type)
    }

    pub fn get_operation_status(env: Env, operation_id: BytesN<32>) -> Option<OperationStatus> {
        let operation: AtomicOperation = env.storage().instance().get(&DataKey::AtomicOperation(operation_id))?;
        Some(operation.status)
    }

    pub fn get_callback(env: Env, callback_id: BytesN<32>) -> Option<Callback> {
        let registry: CallbackRegistry = env.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        registry.callbacks.get(callback_id)
    }

    pub fn get_dependency_graph(env: Env) -> DependencyGraph {
        env.storage().instance().get(&DataKey::DependencyGraph).unwrap()
    }

    pub fn version(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn check_call_permissions(env: &Env, caller: &Address, contract_address: &Address) -> Result<(), CrossContractError> {
        let registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
        if let Some(contract_info) = registry.contracts.get(contract_address.clone()) {
            if !contract_info.active {
                return Err(CrossContractError::ContractNotFound);
            }

            // Check if caller is in allowed list
            if !contract_info.permissions.can_be_called_by.is_empty() {
                let mut allowed = false;
                for allowed_caller in contract_info.permissions.can_be_called_by.iter() {
                    if allowed_caller == caller {
                        allowed = true;
                        break;
                    }
                }
                if !allowed {
                    return Err(CrossContractError::PermissionDenied);
                }
            }

            Ok(())
        } else {
            Err(CrossContractError::ContractNotFound)
        }
    }

    fn check_circular_dependencies(env: &Env, contract_address: &Address, dependencies: &Vec<Address>) -> Result<(), CrossContractError> {
        let graph: DependencyGraph = env.storage().instance().get(&DataKey::DependencyGraph).unwrap();
        
        // Simple DFS to detect cycles
        let mut visited = Vec::new(env);
        let mut recursion_stack = Vec::new(env);
        
        if Self::has_cycle_dfs(env, &graph, contract_address, &mut visited, &mut recursion_stack) {
            return Err(CrossContractError::CircularDependency);
        }
        
        Ok(())
    }

    fn has_cycle_dfs(
        env: &Env,
        graph: &DependencyGraph,
        node: &Address,
        visited: &mut Vec<Address>,
        recursion_stack: &mut Vec<Address>,
    ) -> bool {
        visited.push_back(node.clone());
        recursion_stack.push_back(node.clone());

        if let Some(node_info) = graph.nodes.get(node.clone()) {
            for neighbor in node_info.dependencies.iter() {
                if !visited.contains(neighbor) {
                    if Self::has_cycle_dfs(env, graph, neighbor, visited, recursion_stack) {
                        return true;
                    }
                } else if recursion_stack.contains(neighbor) {
                    return true;
                }
            }
        }

        recursion_stack.pop();
        false
    }

    fn update_dependency_graph(env: &Env, contract_address: &Address, contract_type: &Symbol, dependencies: &Vec<Address>) {
        let mut graph: DependencyGraph = env.storage().instance().get(&DataKey::DependencyGraph).unwrap();
        
        // Create node
        let node = DependencyNode {
            contract_address: contract_address.clone(),
            contract_type: contract_type.clone(),
            dependents: Vec::new(env),
            dependencies: dependencies.clone(),
            circular_dependency: false,
        };
        
        graph.nodes.set(contract_address.clone(), node);
        
        // Create edges
        for dependency in dependencies.iter() {
            let edge = DependencyEdge {
                from: contract_address.clone(),
                to: dependency.clone(),
                dependency_type: DependencyType::Required,
            };
            graph.edges.push_back(edge);
        }
        
        env.storage().instance().set(&DataKey::DependencyGraph, &graph);
    }

    fn execute_operations(env: &Env, operation_id: BytesN<32>) -> Result<(), CrossContractError> {
        let mut atomic_op: AtomicOperation = env.storage().instance().get(&DataKey::AtomicOperation(operation_id.clone()))
            .ok_or(CrossContractError::OperationNotFound)?;

        // Check timeout
        let deadline = atomic_op.created_at.checked_add(atomic_op.timeout).expect("Timestamp overflow");
        if env.ledger().timestamp() > deadline {
            atomic_op.status = OperationStatus::Failed;
            env.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
            return Err(CrossContractError::OperationTimeout);
        }

        atomic_op.status = OperationStatus::InProgress;
        env.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);

        // Execute each operation
        for (i, operation) in atomic_op.operations.iter().enumerate() {
            let result = env.invoke_contract::<soroban_sdk::Val>(
                &operation.contract_address,
                &operation.function_name,
                operation.arguments.clone(),
            );

            // Store rollback data if needed
            if operation.requires_success {
                let rollback_data = RollbackData {
                    contract_address: operation.contract_address.clone(),
                    rollback_function: symbol_short!("rollback"),
                    rollback_arguments: Vec::new(env),
                };
                atomic_op.rollback_data.push_back(rollback_data);
            }

            // Handle failure
            if operation.requires_success && result == soroban_sdk::Val::VOID {
                // Rollback previous operations
                Self::rollback_operations(env, &atomic_op, i)?;
                atomic_op.status = OperationStatus::Failed;
                env.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
                return Err(CrossContractError::AtomicOperationFailed);
            }
        }

        atomic_op.status = OperationStatus::Completed;
        env.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);

        // Update queue
        let mut queue: OperationQueue = env.storage().instance().get(&DataKey::OperationQueue).unwrap();
        queue.pending_operations.remove_first(|id| id == &operation_id);
        queue.completed_operations.push_back(operation_id.clone());
        env.storage().instance().set(&DataKey::OperationQueue, &queue);

        Ok(())
    }

    fn rollback_operations(env: &Env, atomic_op: &AtomicOperation, failed_index: u32) -> Result<(), CrossContractError> {
        // Rollback operations in reverse order
        for i in (0..failed_index).rev() {
            if let Some(rollback_data) = atomic_op.rollback_data.get(i as usize) {
                let _result = env.invoke_contract::<soroban_sdk::Val>(
                    &rollback_data.contract_address,
                    &rollback_data.rollback_function,
                    rollback_data.rollback_arguments.clone(),
                );
            }
        }
        Ok(())
    }

    fn generate_operation_id(env: &Env, caller: &Address, operations: &Vec<ContractCall>) -> BytesN<32> {
        let mut data = Vec::new(env);
        data.push_back(caller.to_val());
        data.push_back(env.ledger().timestamp().to_val());
        data.push_back(operations.len().into_val(env));
        
        for operation in operations.iter() {
            data.push_back(operation.contract_address.to_val());
            data.push_back(operation.function_name.to_val());
        }
        
        env.crypto().sha256(&data.to_bytes())
    }

    fn generate_callback_id(env: &Env, trigger_contract: &Address, trigger_function: &Symbol) -> BytesN<32> {
        let mut data = Vec::new(env);
        data.push_back(trigger_contract.to_val());
        data.push_back(trigger_function.to_val());
        data.push_back(env.ledger().timestamp().to_val());
        
        env.crypto().sha256(&data.to_bytes())
    }

    fn get_contract_info(env: &Env, contract_address: &Address) -> Result<ContractInfo, CrossContractError> {
        let registry: ContractRegistry = env.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.get(contract_address.clone())
            .ok_or(CrossContractError::ContractNotFound)
    }
}
