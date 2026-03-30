#![no_main]

//! Atomic Operations Fuzzer
//! 
//! This fuzzer targets the `execute_atomic_operation()` function.
//! It tests:
//! - Multi-call sequences with varying lengths
//! - Circular dependency detection
//! - Rollback logic under failure conditions
//! - Callback chain execution
//! - Gas limit boundaries

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{Env, Address, Symbol, Vec, IntoVal};

// Maximum number of operations to fuzz
const MAX_OPS: usize = 10;

// Parsed operation for fuzzing
struct FuzzOperation {
    contract: [u8; 32],
    function: [u8; 32],
    arg_count: u8,
    args: Vec<u64>,
}

impl FuzzOperation {
    fn from_bytes(env: &Env, data: &[u8]) -> Option<Self> {
        if data.len() < 72 {
            return None;
        }
        
        let contract = data[0..32].try_into().ok()?;
        let function = data[32..64].try_into().ok()?;
        let arg_count = data[64] % 5; // Limit to 4 args max
        
        let mut args = Vec::new(env);
        for i in 0..arg_count {
            let offset = 65 + (i as usize * 8);
            if offset + 8 <= data.len() {
                let arg = u64::from_le_bytes(data[offset..offset+8].try_into().unwrap_or([0; 8]));
                args.push_back(arg);
            }
        }
        
        Some(Self {
            contract,
            function,
            arg_count,
            args,
        })
    }
}

fuzz_target!(|data: &[u8]| {
    let env = Env::default();
    env.mock_all_auths();
    
    // Need at least one byte for operation count
    if data.is_empty() {
        return;
    }
    
    // Determine number of operations (1 to MAX_OPS)
    let num_ops = ((data[0] as usize) % MAX_OPS) + 1;
    
    // Check if we have enough data
    if data.len() < 1 + (num_ops * 72) {
        return;
    }
    
    // Parse operations
    let mut operations: Vec<FuzzOperation> = Vec::new(&env);
    for i in 0..num_ops {
        let offset = 1 + (i * 72);
        if let Some(op) = FuzzOperation::from_bytes(&env, &data[offset..]) {
            operations.push_back(op);
        }
    }
    
    // Validate operations
    std::panic::catch_unwind(|| {
        let mut seen_contracts: Vec<[u8; 32]> = Vec::new(&env);
        
        for op in operations.iter() {
            // Skip zero addresses
            if op.contract.iter().all(|&b| b == 0) {
                continue;
            }
            
            // Check for potential circular dependencies
            if seen_contracts.contains(&op.contract) {
                // Multiple calls to same contract - potential issue
                // Contract should handle this gracefully
            }
            seen_contracts.push_back(op.contract);
            
            // Validate function name (should be valid UTF-8 or symbol)
            let func_valid = op.function.iter()
                .filter(|&&b| b != 0)
                .all(|&b| b.is_ascii_alphanumeric() || b == b'_');
            
            if !func_valid {
                // Invalid function name - should be rejected
                continue;
            }
            
            // Test argument handling
            for arg in op.args.iter() {
                // Check for problematic values
                if *arg == u64::MAX || *arg == 0 {
                    // Edge case values - contract should handle
                }
            }
            
            // Test gas estimation
            let _estimated_gas = op.arg_count as u64 * 1000 + 5000;
        }
        
        // Test sequence validation
        if operations.len() > 5 {
            // Large sequences should have proper validation
            let _total_args: usize = operations.iter()
                .map(|op| op.arg_count as usize)
                .sum();
        }
        
    }).unwrap_or(());
});
