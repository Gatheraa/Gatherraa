use soroban_sdk::{Address, BytesN, Env, Symbol};

/// Upgrade manager for contract upgrades
pub struct UpgradeManager;

impl UpgradeManager {
    /// Schedule an upgrade with timelock
    pub fn schedule_upgrade(
        e: &Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
        unlock_time: u64,
        upgrade_key: Symbol,
    ) {
        admin.require_auth();
        
        if e.ledger().timestamp() >= unlock_time {
            panic!("unlock_time must be in the future");
        }

        e.storage()
            .instance()
            .set(&upgrade_key, &(new_wasm_hash.clone(), unlock_time));

        e.events()
            .publish((Symbol::new(e, "UpgradeScheduled"),), (new_wasm_hash, unlock_time));
    }

    /// Cancel a scheduled upgrade
    pub fn cancel_upgrade(e: &Env, admin: Address, upgrade_key: Symbol) {
        admin.require_auth();
        
        e.storage().instance().remove(&upgrade_key);
        e.events()
            .publish((Symbol::new(e, "UpgradeCancelled"),), ());
    }

    /// Execute the scheduled upgrade
    pub fn execute_upgrade(
        e: &Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
        upgrade_key: Symbol,
    ) {
        admin.require_auth();

        let (scheduled_hash, unlock_time): (BytesN<32>, u64) = e
            .storage()
            .instance()
            .get(&upgrade_key)
            .unwrap_or_else(|| panic!("no upgrade scheduled"));

        if scheduled_hash != new_wasm_hash {
            panic!("wasm hash does not match scheduled");
        }
        if e.ledger().timestamp() < unlock_time {
            panic!("timelock not expired");
        }

        // Clear the timelock so it can't be reused
        e.storage().instance().remove(&upgrade_key);

        // Perform the upgrade
        e.deployer()
            .update_current_contract_wasm(new_wasm_hash.clone());

        e.events()
            .publish((Symbol::new(e, "Upgraded"),), new_wasm_hash);
    }

    /// Check if upgrade is scheduled
    pub fn is_upgrade_scheduled(e: &Env, upgrade_key: Symbol) -> bool {
        e.storage()
            .instance()
            .has(&upgrade_key)
    }

    /// Get scheduled upgrade details
    pub fn get_scheduled_upgrade(
        e: &Env,
        upgrade_key: Symbol,
    ) -> Option<(BytesN<32>, u64)> {
        e.storage()
            .instance()
            .get(&upgrade_key)
    }

    /// Validate upgrade timing
    pub fn validate_upgrade_timing(
        e: &Env,
        unlock_time: u64,
        min_timelock: u64,
    ) -> Result<(), String> {
        let current_time = e.ledger().timestamp();
        
        if unlock_time <= current_time {
            return Err("unlock_time must be in the future".into());
        }
        
        if unlock_time - current_time < min_timelock {
            return Err("timelock too short".into());
        }
        
        Ok(())
    }
}
