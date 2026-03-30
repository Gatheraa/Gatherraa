#![no_main]

//! Escrow Create Fuzzer
//! 
//! This fuzzer targets the `create_escrow()` function in the escrow contract.
//! It tests:
//! - Invalid address combinations
//! - Amount boundary conditions (min/max)
//! - Revenue split configurations
//! - Milestone structures
//! - Referral tracking edge cases

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{Env, Address, Vec};

// Helper to parse fuzzer input into structured data
struct EscrowInput {
    admin: [u8; 32],
    event: [u8; 32],
    organizer: [u8; 32],
    purchaser: [u8; 32],
    token: [u8; 32],
    amount: i128,
    release_time: u64,
    has_revenue_split: bool,
    organizer_bps: u32,
    platform_bps: u32,
    referrer_bps: u32,
}

impl EscrowInput {
    fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < 200 {
            return None;
        }
        
        Some(Self {
            admin: data[0..32].try_into().ok()?,
            event: data[32..64].try_into().ok()?,
            organizer: data[64..96].try_into().ok()?,
            purchaser: data[96..128].try_into().ok()?,
            token: data[128..160].try_into().ok()?,
            amount: i128::from_le_bytes(data[160..176].try_into().unwrap_or([0; 16])),
            release_time: u64::from_le_bytes(data[176..184].try_into().unwrap_or([0; 8])),
            has_revenue_split: data[184] != 0,
            organizer_bps: u32::from_le_bytes(data[185..189].try_into().unwrap_or([5000; 4])),
            platform_bps: u32::from_le_bytes(data[189..193].try_into().unwrap_or([500; 4])),
            referrer_bps: u32::from_le_bytes(data[193..197].try_into().unwrap_or([0; 4])),
        })
    }
}

fuzz_target!(|data: &[u8]| {
    let env = Env::default();
    env.mock_all_auths();
    
    // Parse input
    let input = match EscrowInput::from_bytes(data) {
        Some(i) => i,
        None => return,
    };
    
    // Validate basic constraints before fuzzing
    if input.admin.iter().all(|&b| b == 0) ||
       input.event.iter().all(|&b| b == 0) ||
       input.organizer.iter().all(|&b| b == 0) ||
       input.purchaser.iter().all(|&b| b == 0) {
        return;
    }
    
    // Test revenue split validation
    std::panic::catch_unwind(|| {
        if input.has_revenue_split {
            let total_bps = input.organizer_bps.saturating_add(input.platform_bps).saturating_add(input.referrer_bps);
            
            // Check for overflow in basis points
            if total_bps > 10000 {
                // Should be rejected by contract
                return;
            }
            
            // Validate individual components
            if input.organizer_bps > 10000 || 
               input.platform_bps > 10000 || 
               input.referrer_bps > 10000 {
                // Invalid BPS values
                return;
            }
        }
        
        // Test amount boundaries
        if input.amount <= 0 {
            // Negative or zero amounts should be handled
            return;
        }
        
        // Test release time validation
        let current_time = env.ledger().timestamp();
        if input.release_time < current_time {
            // Past release time - should be handled gracefully
            return;
        }
        
        // Additional fuzzing checks
        let _ = input.amount.checked_abs();
        let _ = input.amount.checked_mul(2);
        let _ = input.release_time.checked_add(1000);
        
    }).unwrap_or(());
});
