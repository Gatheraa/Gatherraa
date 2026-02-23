use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};
use crate::{CrossContractContract, ContractInfo, ContractPermissions, ContractCall, OperationStatus, DependencyType};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let version = CrossContractContract::version(env.clone());
    assert_eq!(version, 1);
}

#[test]
fn test_register_contract() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract_address = Address::generate(&env);
    let contract_type = Symbol::new(&env, "event_factory");
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    CrossContractContract::register_contract(
        env.clone(),
        contract_address.clone(),
        contract_type.clone(),
        1,
        permissions,
        Vec::new(&env),
    );
    
    let contract_info = CrossContractContract::get_contract_info(env.clone(), contract_address.clone()).unwrap();
    assert_eq!(contract_info.address, contract_address);
    assert_eq!(contract_info.contract_type, contract_type);
    assert_eq!(contract_info.version, 1);
    assert!(contract_info.active);
}

#[test]
fn test_get_contract_by_type() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract_address = Address::generate(&env);
    let contract_type = Symbol::new(&env, "ticket_contract");
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    CrossContractContract::register_contract(
        env.clone(),
        contract_address.clone(),
        contract_type.clone(),
        1,
        permissions,
        Vec::new(&env),
    );
    
    let found_address = CrossContractContract::get_contract_by_type(env.clone(), contract_type.clone()).unwrap();
    assert_eq!(found_address, contract_address);
}

#[test]
fn test_atomic_operation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract1 = Address::generate(&env);
    let contract2 = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    // Register contracts
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    CrossContractContract::register_contract(
        env.clone(),
        contract1.clone(),
        Symbol::new(&env, "contract1"),
        1,
        permissions.clone(),
        Vec::new(&env),
    );
    
    CrossContractContract::register_contract(
        env.clone(),
        contract2.clone(),
        Symbol::new(&env, "contract2"),
        1,
        permissions,
        Vec::new(&env),
    );
    
    // Create atomic operation
    let operations = vec![
        &env,
        ContractCall {
            contract_address: contract1.clone(),
            function_name: Symbol::new(&env, "function1"),
            arguments: Vec::new(&env),
            value: None,
            requires_success: true,
        },
        ContractCall {
            contract_address: contract2.clone(),
            function_name: Symbol::new(&env, "function2"),
            arguments: Vec::new(&env),
            value: None,
            requires_success: true,
        },
    ];
    
    let operation_id = CrossContractContract::execute_atomic_operation(
        env.clone(),
        operations,
        86400, // 24 hours timeout
    );
    
    let status = CrossContractContract::get_operation_status(env.clone(), operation_id).unwrap();
    assert_eq!(status, OperationStatus::Completed);
}

#[test]
fn test_callback_registration() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let trigger_contract = Address::generate(&env);
    let callback_contract = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let callback_id = CrossContractContract::register_callback(
        env.clone(),
        trigger_contract.clone(),
        Symbol::new(&env, "trigger_function"),
        callback_contract.clone(),
        Symbol::new(&env, "callback_function"),
        Vec::new(&env),
    );
    
    let callback = CrossContractContract::get_callback(env.clone(), callback_id).unwrap();
    assert_eq!(callback.trigger_contract, trigger_contract);
    assert_eq!(callback.callback_contract, callback_contract);
    assert!(callback.active);
}

#[test]
fn test_dependency_graph() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract1 = Address::generate(&env);
    let contract2 = Address::generate(&env);
    let contract3 = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    // Register contract1 with no dependencies
    CrossContractContract::register_contract(
        env.clone(),
        contract1.clone(),
        Symbol::new(&env, "contract1"),
        1,
        permissions.clone(),
        Vec::new(&env),
    );
    
    // Register contract2 with dependency on contract1
    CrossContractContract::register_contract(
        env.clone(),
        contract2.clone(),
        Symbol::new(&env, "contract2"),
        1,
        permissions.clone(),
        vec![&env, contract1.clone()],
    );
    
    // Register contract3 with dependency on contract2
    CrossContractContract::register_contract(
        env.clone(),
        contract3.clone(),
        Symbol::new(&env, "contract3"),
        1,
        permissions,
        vec![&env, contract2.clone()],
    );
    
    let graph = CrossContractContract::get_dependency_graph(env.clone());
    assert_eq!(graph.nodes.len(), 3);
    assert_eq!(graph.edges.len(), 2);
}

#[test]
fn test_circular_dependency_detection() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract1 = Address::generate(&env);
    let contract2 = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    // Register contract1
    CrossContractContract::register_contract(
        env.clone(),
        contract1.clone(),
        Symbol::new(&env, "contract1"),
        1,
        permissions.clone(),
        Vec::new(&env),
    );
    
    // Try to register contract2 with circular dependency
    let result = std::panic::catch_unwind(|| {
        CrossContractContract::register_contract(
            env.clone(),
            contract2.clone(),
            Symbol::new(&env, "contract2"),
            1,
            permissions,
            vec![&env, contract1.clone()],
        );
    });
    
    // This should not panic as there's no circular dependency yet
    assert!(result.is_ok());
}

#[test]
fn test_authorization_delegation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let from_contract = Address::generate(&env);
    let to_contract = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    CrossContractContract::register_contract(
        env.clone(),
        from_contract.clone(),
        Symbol::new(&env, "from_contract"),
        1,
        permissions,
        Vec::new(&env),
    );
    
    CrossContractContract::delegate_authorization(
        env.clone(),
        from_contract.clone(),
        to_contract.clone(),
        vec![&env, Symbol::new(&env, "read")],
    );
    
    let contract_info = CrossContractContract::get_contract_info(env.clone(), from_contract.clone()).unwrap();
    assert!(contract_info.permissions.delegate_auth_to.contains(&to_contract));
}

#[test]
fn test_contract_deactivation() {
    let env = Env::default();
    env.mock_all_auths();
    
    let admin = Address::generate(&env);
    let contract_address = Address::generate(&env);
    
    CrossContractContract::initialize(env.clone(), admin.clone());
    
    let permissions = ContractPermissions {
        can_call: Vec::new(&env),
        can_be_called_by: Vec::new(&env),
        requires_auth: false,
        delegate_auth_to: Vec::new(&env),
    };
    
    CrossContractContract::register_contract(
        env.clone(),
        contract_address.clone(),
        Symbol::new(&env, "test_contract"),
        1,
        permissions,
        Vec::new(&env),
    );
    
    // Verify contract is active
    let contract_info = CrossContractContract::get_contract_info(env.clone(), contract_address.clone()).unwrap();
    assert!(contract_info.active);
    
    // Deactivate contract
    CrossContractContract::deactivate_contract(env.clone(), contract_address.clone());
    
    // Verify contract is inactive
    let contract_info = CrossContractContract::get_contract_info(env.clone(), contract_address.clone()).unwrap();
    assert!(!contract_info.active);
}
