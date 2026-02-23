#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, ContractRegistry, ContractInfo, ContractPermissions, AtomicOperation, 
                   ContractCall, OperationStatus, RollbackData, CallbackRegistry, Callback, 
                   DependencyGraph, DependencyNode, DependencyEdge, DependencyType, OperationQueue,
                   ContractState, CrossContractError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct CrossContractContract;

#[contractimpl]
impl CrossContractContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        
        // Initialize registries
        let registry = ContractRegistry {
            contracts: map![&e],
            contract_types: map![&e],
            contract_versions: map![&e],
        };
        e.storage().instance().set(&DataKey::ContractRegistry, &registry);
        
        let callback_registry = CallbackRegistry {
            callbacks: map![&e],
            active_callbacks: Vec::new(&e),
        };
        e.storage().instance().set(&DataKey::CallbackRegistry, &callback_registry);
        
        let dependency_graph = DependencyGraph {
            nodes: map![&e],
            edges: Vec::new(&e),
        };
        e.storage().instance().set(&DataKey::DependencyGraph, &dependency_graph);
        
        let operation_queue = OperationQueue {
            pending_operations: Vec::new(&e),
            processing_operations: Vec::new(&e),
            completed_operations: Vec::new(&e),
            failed_operations: Vec::new(&e),
        };
        e.storage().instance().set(&DataKey::OperationQueue, &operation_queue);
    }

    // Register a contract
    pub fn register_contract(
        e: Env,
        contract_address: Address,
        contract_type: Symbol,
        version: u32,
        permissions: ContractPermissions,
        dependencies: Vec<Address>,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Check for circular dependencies
        Self::check_circular_dependencies(&e, &contract_address, &dependencies)?;

        let contract_info = ContractInfo {
            address: contract_address.clone(),
            contract_type: contract_type.clone(),
            version,
            active: true,
            permissions: permissions.clone(),
            dependencies: dependencies.clone(),
            registered_at: e.ledger().timestamp(),
        };

        // Update registry
        let mut registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.set(contract_address.clone(), contract_info.clone());
        registry.contract_types.set(contract_type.clone(), contract_address.clone());
        registry.contract_versions.set(contract_address.clone(), version);
        e.storage().instance().set(&DataKey::ContractRegistry, &registry);

        // Update dependency graph
        Self::update_dependency_graph(&e, &contract_address, &contract_type, &dependencies);

        // Store permissions
        e.storage().instance().set(&DataKey::ContractPermissions, &permissions);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("contract_registered"), contract_address.clone()),
            (contract_type, version),
        );
    }

    // Execute single contract call
    pub fn call_contract(
        e: Env,
        contract_address: Address,
        function_name: Symbol,
        arguments: Vec<soroban_sdk::Val>,
        value: Option<i128>,
    ) -> soroban_sdk::Val {
        let caller = e.current_contract_address();
        
        // Check permissions
        Self::check_call_permissions(&e, &caller, &contract_address)?;

        let contract_info = Self::get_contract_info(&e, &contract_address)?;
        
        // Check if contract is active
        if !contract_info.active {
            panic!("contract is not active");
        }

        // Execute call
        let result = e.invoke_contract::<soroban_sdk::Val>(
            &contract_address,
            &function_name,
            arguments,
        );

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("contract_called"), contract_address.clone()),
            (function_name, caller),
        );

        result
    }

    // Execute atomic operation
    pub fn execute_atomic_operation(
        e: Env,
        operations: Vec<ContractCall>,
        timeout: u64,
    ) -> BytesN<32> {
        let caller = e.current_contract_address();
        
        // Generate operation ID
        let operation_id = Self::generate_operation_id(&e, &caller, &operations);
        
        let atomic_op = AtomicOperation {
            id: operation_id.clone(),
            operations: operations.clone(),
            status: OperationStatus::Pending,
            created_at: e.ledger().timestamp(),
            timeout,
            rollback_data: Vec::new(&e),
            caller: caller.clone(),
        };

        // Store operation
        e.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
        
        // Add to queue
        let mut queue: OperationQueue = e.storage().instance().get(&DataKey::OperationQueue).unwrap();
        queue.pending_operations.push_back(operation_id.clone());
        e.storage().instance().set(&DataKey::OperationQueue, &queue);

        // Execute operations
        Self::execute_operations(&e, operation_id.clone())?;

        operation_id
    }

    // Register callback
    pub fn register_callback(
        e: Env,
        trigger_contract: Address,
        trigger_function: Symbol,
        callback_contract: Address,
        callback_function: Symbol,
        callback_data: Vec<soroban_sdk::Val>,
    ) -> BytesN<32> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let callback_id = Self::generate_callback_id(&e, &trigger_contract, &trigger_function);
        
        let callback = Callback {
            id: callback_id.clone(),
            trigger_contract: trigger_contract.clone(),
            trigger_function: trigger_function.clone(),
            callback_contract: callback_contract.clone(),
            callback_function: callback_function.clone(),
            callback_data: callback_data.clone(),
            active: true,
            created_at: e.ledger().timestamp(),
        };

        // Store callback
        let mut registry: CallbackRegistry = e.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        registry.callbacks.set(callback_id.clone(), callback.clone());
        registry.active_callbacks.push_back(callback_id.clone());
        e.storage().instance().set(&DataKey::CallbackRegistry, &registry);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("callback_registered"), callback_id.clone()),
            (trigger_contract, trigger_function),
        );

        callback_id
    }

    // Trigger callback
    pub fn trigger_callback(e: Env, trigger_contract: Address, trigger_function: Symbol, trigger_data: Vec<soroban_sdk::Val>) {
        let registry: CallbackRegistry = e.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        
        // Find matching callbacks
        let mut callbacks_to_execute = Vec::new(&e);
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
                let _result = e.invoke_contract::<soroban_sdk::Val>(
                    &callback.callback_contract,
                    &callback.callback_function,
                    callback_args,
                );

                #[allow(deprecated)]
                e.events().publish(
                    (symbol_short!("callback_executed"), callback.id.clone()),
                    (trigger_contract, trigger_function),
                );
            }
        }
    }

    // Sync contract state
    pub fn sync_contract_state(e: Env, contract_address: Address, state_hash: BytesN<32>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let contract_info = Self::get_contract_info(&e, &contract_address)?;
        
        let state = ContractState {
            contract_address: contract_address.clone(),
            state_hash: state_hash.clone(),
            last_updated: e.ledger().timestamp(),
            version: contract_info.version,
        };

        // Store state
        e.storage().persistent().set(&contract_address, &state);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("state_synced"), contract_address.clone()),
            state_hash,
        );
    }

    // Verify ticket purchase across contracts
    pub fn verify_ticket_purchase(
        e: Env,
        event_contract: Address,
        ticket_contract: Address,
        purchaser: Address,
        ticket_id: u32,
    ) -> bool {
        // Check ticket contract for ticket ownership
        let ticket_owner_result = e.invoke_contract::<Address>(
            &ticket_contract,
            &symbol_short!("owner_of"),
            vec![&e, ticket_id.into_val(&e)],
        );

        if ticket_owner_result != purchaser {
            return false;
        }

        // Check event contract for ticket validity
        let ticket_valid_result = e.invoke_contract::<bool>(
            &event_contract,
            &symbol_short!("is_ticket_valid"),
            vec![&e, ticket_id.into_val(&e)],
        );

        ticket_valid_result
    }

    // Delegate authorization
    pub fn delegate_authorization(e: Env, from_contract: Address, to_contract: Address, permissions: Vec<Symbol>) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Update contract permissions
        let mut registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
        if let Some(mut contract_info) = registry.contracts.get(from_contract.clone()) {
            for permission in permissions.iter() {
                contract_info.permissions.delegate_auth_to.push_back(to_contract.clone());
            }
            registry.contracts.set(from_contract.clone(), contract_info);
        }

        e.storage().instance().set(&DataKey::ContractRegistry, &registry);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("auth_delegated"), from_contract.clone()),
            to_contract,
        );
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

    pub fn deactivate_contract(e: Env, contract_address: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
        if let Some(mut contract_info) = registry.contracts.get(contract_address.clone()) {
            contract_info.active = false;
            registry.contracts.set(contract_address.clone(), contract_info);
        }

        e.storage().instance().set(&DataKey::ContractRegistry, &registry);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("contract_deactivated"), contract_address.clone()),
            (),
        );
    }

    // View functions
    pub fn get_contract_info(e: Env, contract_address: Address) -> Option<ContractInfo> {
        let registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.get(contract_address)
    }

    pub fn get_contract_by_type(e: Env, contract_type: Symbol) -> Option<Address> {
        let registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contract_types.get(contract_type)
    }

    pub fn get_operation_status(e: Env, operation_id: BytesN<32>) -> Option<OperationStatus> {
        let operation: AtomicOperation = e.storage().instance().get(&DataKey::AtomicOperation(operation_id))?;
        Some(operation.status)
    }

    pub fn get_callback(e: Env, callback_id: BytesN<32>) -> Option<Callback> {
        let registry: CallbackRegistry = e.storage().instance().get(&DataKey::CallbackRegistry).unwrap();
        registry.callbacks.get(callback_id)
    }

    pub fn get_dependency_graph(e: Env) -> DependencyGraph {
        e.storage().instance().get(&DataKey::DependencyGraph).unwrap()
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn check_call_permissions(e: &Env, caller: &Address, contract_address: &Address) -> Result<(), CrossContractError> {
        let registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        
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

    fn check_circular_dependencies(e: &Env, contract_address: &Address, dependencies: &Vec<Address>) -> Result<(), CrossContractError> {
        let graph: DependencyGraph = e.storage().instance().get(&DataKey::DependencyGraph).unwrap();
        
        // Simple DFS to detect cycles
        let mut visited = Vec::new(e);
        let mut recursion_stack = Vec::new(e);
        
        if Self::has_cycle_dfs(e, &graph, contract_address, &mut visited, &mut recursion_stack) {
            return Err(CrossContractError::CircularDependency);
        }
        
        Ok(())
    }

    fn has_cycle_dfs(
        e: &Env,
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
                    if Self::has_cycle_dfs(e, graph, neighbor, visited, recursion_stack) {
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

    fn update_dependency_graph(e: &Env, contract_address: &Address, contract_type: &Symbol, dependencies: &Vec<Address>) {
        let mut graph: DependencyGraph = e.storage().instance().get(&DataKey::DependencyGraph).unwrap();
        
        // Create node
        let node = DependencyNode {
            contract_address: contract_address.clone(),
            contract_type: contract_type.clone(),
            dependents: Vec::new(e),
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
        
        e.storage().instance().set(&DataKey::DependencyGraph, &graph);
    }

    fn execute_operations(e: &Env, operation_id: BytesN<32>) -> Result<(), CrossContractError> {
        let mut atomic_op: AtomicOperation = e.storage().instance().get(&DataKey::AtomicOperation(operation_id.clone()))
            .ok_or(CrossContractError::OperationNotFound)?;

        // Check timeout
        if e.ledger().timestamp() > atomic_op.created_at + atomic_op.timeout {
            atomic_op.status = OperationStatus::Failed;
            e.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
            return Err(CrossContractError::OperationTimeout);
        }

        atomic_op.status = OperationStatus::InProgress;
        e.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);

        // Execute each operation
        for (i, operation) in atomic_op.operations.iter().enumerate() {
            let result = e.invoke_contract::<soroban_sdk::Val>(
                &operation.contract_address,
                &operation.function_name,
                operation.arguments.clone(),
            );

            // Store rollback data if needed
            if operation.requires_success {
                let rollback_data = RollbackData {
                    contract_address: operation.contract_address.clone(),
                    rollback_function: symbol_short!("rollback"),
                    rollback_arguments: Vec::new(e),
                };
                atomic_op.rollback_data.push_back(rollback_data);
            }

            // Handle failure
            if operation.requires_success && result == soroban_sdk::Val::VOID {
                // Rollback previous operations
                Self::rollback_operations(e, &atomic_op, i)?;
                atomic_op.status = OperationStatus::Failed;
                e.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);
                return Err(CrossContractError::AtomicOperationFailed);
            }
        }

        atomic_op.status = OperationStatus::Completed;
        e.storage().instance().set(&DataKey::AtomicOperation(operation_id.clone()), &atomic_op);

        // Update queue
        let mut queue: OperationQueue = e.storage().instance().get(&DataKey::OperationQueue).unwrap();
        queue.pending_operations.remove_first(|id| id == &operation_id);
        queue.completed_operations.push_back(operation_id.clone());
        e.storage().instance().set(&DataKey::OperationQueue, &queue);

        Ok(())
    }

    fn rollback_operations(e: &Env, atomic_op: &AtomicOperation, failed_index: u32) -> Result<(), CrossContractError> {
        // Rollback operations in reverse order
        for i in (0..failed_index).rev() {
            if let Some(rollback_data) = atomic_op.rollback_data.get(i as usize) {
                let _result = e.invoke_contract::<soroban_sdk::Val>(
                    &rollback_data.contract_address,
                    &rollback_data.rollback_function,
                    rollback_data.rollback_arguments.clone(),
                );
            }
        }
        Ok(())
    }

    fn generate_operation_id(e: &Env, caller: &Address, operations: &Vec<ContractCall>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(caller.to_val());
        data.push_back(e.ledger().timestamp().to_val());
        data.push_back(operations.len().into_val(e));
        
        for operation in operations.iter() {
            data.push_back(operation.contract_address.to_val());
            data.push_back(operation.function_name.to_val());
        }
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn generate_callback_id(e: &Env, trigger_contract: &Address, trigger_function: &Symbol) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(trigger_contract.to_val());
        data.push_back(trigger_function.to_val());
        data.push_back(e.ledger().timestamp().to_val());
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn get_contract_info(e: &Env, contract_address: &Address) -> Result<ContractInfo, CrossContractError> {
        let registry: ContractRegistry = e.storage().instance().get(&DataKey::ContractRegistry).unwrap();
        registry.contracts.get(contract_address.clone())
            .ok_or(CrossContractError::ContractNotFound)
    }
}
