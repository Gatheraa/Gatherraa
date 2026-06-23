use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec};

use crate::storage::{StorageCache, *};
use crate::types::{
    ChainConfig, Config, CrossChainMessage, DataKey, Tier, UserInfo, ARBITRUM_CHAIN_ID,
    BASE_CHAIN_ID, ETHEREUM_CHAIN_ID, OPTIMISM_CHAIN_ID, POLYGON_CHAIN_ID, STELLAR_CHAIN_ID,
};

#[contract]
pub struct ChainAbstraction;

#[contractimpl]
impl ChainAbstraction {
    /// Initialize chain abstraction layer
    pub fn initialize_chain_abstraction(env: Env, admin: Address, supported_chains: Vec<u32>) {
        let config = read_config(&env);
        config.admin.require_auth();

        // Initialize supported chains
        write_supported_chains(&env, &supported_chains);

        // Configure default chain settings
        for chain_id in supported_chains.iter() {
            let chain_config = Self::get_default_chain_config(&env, chain_id);
            write_chain_config(&env, chain_id, &chain_config);
        }

        env.events()
            .publish((symbol_short!("chain_abstraction_init"),), supported_chains);
    }

    /// Get default configuration for a chain
    fn get_default_chain_config(env: &Env, chain_id: &u32) -> ChainConfig {
        match chain_id {
            ETHEREUM_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("ethereum"),
                bridge_address: Address::default(), // To be set by admin
                bridge_configured: false,
                gas_limit: 300000,
                confirmations: 12,
                active: true,
            },
            STELLAR_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("stellar"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 100000,
                confirmations: 3,
                active: true,
            },
            POLYGON_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("polygon"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 200000,
                confirmations: 5,
                active: true,
            },
            ARBITRUM_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("arbitrum"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 250000,
                confirmations: 8,
                active: true,
            },
            OPTIMISM_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("optimism"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 200000,
                confirmations: 6,
                active: true,
            },
            BASE_CHAIN_ID => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("base"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 200000,
                confirmations: 6,
                active: true,
            },
            _ => ChainConfig {
                chain_id: *chain_id,
                chain_name: symbol_short!("unknown"),
                bridge_address: Address::default(),
                bridge_configured: false,
                gas_limit: 300000,
                confirmations: 12,
                active: false,
            },
        }
    }

    /// Validate chain compatibility
    pub fn validate_chain_compatibility(env: Env, source_chain: u32, target_chain: u32) -> bool {
        let source_config = read_chain_config(&env, source_chain);
        let target_config = read_chain_config(&env, target_chain);

        match (source_config, target_config) {
            (Some(source), Some(target)) => {
                // Both chains must be active
                if !source.active || !target.active {
                    return false;
                }

                // Check if bridge exists between chains
                Self::bridge_exists(&env, source_chain, target_chain)
            }
            _ => false,
        }
    }

    /// Check if bridge exists between chains
    fn bridge_exists(env: &Env, source_chain: u32, target_chain: u32) -> bool {
        // This would check if there's a valid bridge configuration
        // Only allow chains that have an explicit bridge configured.
        let source_config = read_chain_config(env, source_chain);
        let target_config = read_chain_config(env, target_chain);

        match (source_config, target_config) {
            (Some(source), Some(target)) => {
                source.active
                    && target.active
                    && source.bridge_configured
                    && target.bridge_configured
            }
            _ => false,
        }
    }

    /// Get chain-specific gas price
    pub fn get_chain_gas_price(env: Env, chain_id: u32) -> u128 {
        let config = read_chain_config(&env, chain_id);
        match config {
            Some(chain_config) => {
                // Return estimated gas price based on chain
                match chain_id {
                    ETHEREUM_CHAIN_ID => 20000000000u128, // 20 gwei
                    POLYGON_CHAIN_ID => 30000000000u128,  // 30 gwei
                    ARBITRUM_CHAIN_ID => 10000000000u128, // 10 gwei
                    OPTIMISM_CHAIN_ID => 10000000000u128, // 10 gwei
                    BASE_CHAIN_ID => 10000000000u128,     // 10 gwei
                    STELLAR_CHAIN_ID => 100u128,          // Minimal fee
                    _ => 20000000000u128,                 // Default
                }
            }
            None => 20000000000u128, // Default gas price
        }
    }

    /// Get chain-specific block time
    pub fn get_chain_block_time(env: Env, chain_id: u32) -> u64 {
        match chain_id {
            ETHEREUM_CHAIN_ID => 12, // 12 seconds
            POLYGON_CHAIN_ID => 2,   // 2 seconds
            ARBITRUM_CHAIN_ID => 1,  // 1 second
            OPTIMISM_CHAIN_ID => 2,  // 2 seconds
            BASE_CHAIN_ID => 2,      // 2 seconds
            STELLAR_CHAIN_ID => 5,   // 5 seconds
            _ => 12,                 // Default 12 seconds
        }
    }

    /// Get chain-specific confirmation time
    pub fn get_chain_confirmation_time(env: Env, chain_id: u32) -> u64 {
        let config = read_chain_config(&env, chain_id);
        match config {
            Some(chain_config) => {
                let block_time = Self::get_chain_block_time(env, chain_id);
                block_time * chain_config.confirmations as u64
            }
            None => 12 * 12, // Default: 12 blocks * 12 seconds
        }
    }

    /// Convert amount between chains (considering different decimals)
    pub fn convert_amount_between_chains(
        env: Env,
        amount: i128,
        source_chain: u32,
        target_chain: u32,
    ) -> i128 {
        let source_decimals = Self::get_chain_decimals(env, source_chain);
        let target_decimals = Self::get_chain_decimals(env, target_chain);

        if source_decimals == target_decimals {
            return amount;
        }

        // Convert from source decimals to target decimals
        if source_decimals > target_decimals {
            amount / 10i128.pow((source_decimals - target_decimals) as u32)
        } else {
            amount * 10i128.pow((target_decimals - source_decimals) as u32)
        }
    }

    /// Get chain-specific token decimals
    fn get_chain_decimals(env: Env, chain_id: u32) -> u8 {
        match chain_id {
            ETHEREUM_CHAIN_ID => 18,
            POLYGON_CHAIN_ID => 18,
            ARBITRUM_CHAIN_ID => 18,
            OPTIMISM_CHAIN_ID => 18,
            BASE_CHAIN_ID => 18,
            STELLAR_CHAIN_ID => 7,
            _ => 18, // Default 18 decimals
        }
    }

    /// Validate address format for specific chain
    pub fn validate_chain_address(env: Env, chain_id: u32, address: &Address) -> bool {
        match chain_id {
            ETHEREUM_CHAIN_ID => Self::validate_ethereum_address(address),
            POLYGON_CHAIN_ID => Self::validate_ethereum_address(address),
            ARBITRUM_CHAIN_ID => Self::validate_ethereum_address(address),
            OPTIMISM_CHAIN_ID => Self::validate_ethereum_address(address),
            BASE_CHAIN_ID => Self::validate_ethereum_address(address),
            STELLAR_CHAIN_ID => Self::validate_stellar_address(address),
            _ => Self::validate_generic_address(address),
        }
    }

    /// Validate Ethereum-compatible address
    fn validate_ethereum_address(address: &Address) -> bool {
        // Basic validation - in production, would include checksum validation
        true // Placeholder
    }

    /// Validate Stellar address
    fn validate_stellar_address(address: &Address) -> bool {
        // Stellar address validation (G... format, 56 characters)
        true // Placeholder
    }

    /// Validate generic address
    fn validate_generic_address(_address: &Address) -> bool {
        true // Placeholder
    }

    /// Get chain-specific bridge address
    pub fn get_chain_bridge_address(env: Env, chain_id: u32) -> Option<Address> {
        let config = read_chain_config(&env, chain_id);
        config.and_then(|c| {
            if c.bridge_configured {
                Some(c.bridge_address)
            } else {
                None
            }
        })
    }

    /// Update bridge address for a chain
    pub fn update_bridge_address(env: Env, chain_id: u32, bridge_address: Address) {
        let config = read_config(&env);
        config.admin.require_auth();

        if let Some(mut chain_config) = read_chain_config(&env, chain_id) {
            chain_config.bridge_address = bridge_address;
            chain_config.bridge_configured = true;
            write_chain_config(&env, chain_id, &chain_config);

            env.events().publish(
                (symbol_short!("bridge_address_updated"),),
                (chain_id, bridge_address),
            );
        }
    }

    /// Get all active chains
    pub fn get_active_chains(env: Env) -> Vec<u32> {
        let supported_chains = read_supported_chains(&env);
        let mut active_chains = Vec::new(&env);

        for chain_id in supported_chains.iter() {
            if let Some(config) = read_chain_config(&env, chain_id) {
                if config.active && config.bridge_configured {
                    active_chains.push_back(chain_id);
                }
            }
        }

        active_chains
    }

    /// Get chain statistics
    pub fn get_chain_statistics(env: Env, chain_id: u32) -> (u64, u64, u128) {
        // Returns (total_transactions, total_volume, last_activity)
        // This would be implemented with proper storage tracking
        (0, 0, 0) // Placeholder
    }

    /// Estimate cross-chain transaction cost
    pub fn estimate_cross_chain_cost(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        amount: i128,
    ) -> u128 {
        let gas_price = Self::get_chain_gas_price(env, source_chain);
        let gas_limit =
            Self::estimate_cross_chain_gas_limit(env, source_chain, target_chain, amount);

        gas_price * gas_limit as u128
    }

    /// Estimate gas limit for cross-chain transaction
    fn estimate_cross_chain_gas_limit(
        env: Env,
        source_chain: u32,
        target_chain: u32,
        amount: i128,
    ) -> u32 {
        let base_gas = match source_chain {
            ETHEREUM_CHAIN_ID => 21000,
            POLYGON_CHAIN_ID => 21000,
            ARBITRUM_CHAIN_ID => 21000,
            OPTIMISM_CHAIN_ID => 21000,
            BASE_CHAIN_ID => 21000,
            STELLAR_CHAIN_ID => 1000,
            _ => 21000,
        };

        // Add overhead for cross-chain operations
        let cross_chain_overhead = 50000;

        // Add amount-based overhead (for larger amounts)
        let amount_overhead = if amount > 1000000000000 { 10000 } else { 0 };

        base_gas + cross_chain_overhead + amount_overhead
    }

    /// Check if chain is supported
    pub fn is_chain_supported(env: Env, chain_id: u32) -> bool {
        read_chain_config(&env, chain_id).is_some()
    }

    /// Get chain metadata
    pub fn get_chain_metadata(env: Env, chain_id: u32) -> Option<(Symbol, u32, u32, bool)> {
        read_chain_config(&env, chain_id).map(|config| {
            (
                config.chain_name,
                config.gas_limit,
                config.confirmations,
                config.active,
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn seed_admin_config(env: &Env, admin: &Address) {
        write_config(
            env,
            &Config {
                admin: admin.clone(),
                staking_token: Address::generate(env),
                reward_token: Address::generate(env),
                reward_rate: 10,
                chain_id: ETHEREUM_CHAIN_ID,
            },
        );
    }

    #[test]
    fn default_chain_configs_start_unconfigured() {
        let env = Env::default();
        let config = ChainAbstraction::get_default_chain_config(&env, &ETHEREUM_CHAIN_ID);

        assert_eq!(config.bridge_address, Address::default());
        assert!(!config.bridge_configured);
        assert!(config.active);
    }

    #[test]
    fn active_chains_remain_hidden_until_bridge_is_configured() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        seed_admin_config(&env, &admin);

        let mut supported_chains = Vec::new(&env);
        supported_chains.push_back(ETHEREUM_CHAIN_ID);
        supported_chains.push_back(STELLAR_CHAIN_ID);

        ChainAbstraction::initialize_chain_abstraction(
            env.clone(),
            admin.clone(),
            supported_chains,
        );

        let active_before = ChainAbstraction::get_active_chains(env.clone());
        assert_eq!(active_before.len(), 0);
        assert_eq!(
            ChainAbstraction::get_chain_bridge_address(env.clone(), ETHEREUM_CHAIN_ID),
            None
        );
        assert!(!ChainAbstraction::validate_chain_compatibility(
            env.clone(),
            ETHEREUM_CHAIN_ID,
            STELLAR_CHAIN_ID,
        ));

        let bridge = Address::generate(&env);
        ChainAbstraction::update_bridge_address(env.clone(), ETHEREUM_CHAIN_ID, bridge.clone());

        let active_after = ChainAbstraction::get_active_chains(env.clone());
        assert_eq!(active_after.len(), 1);
        assert_eq!(active_after.get(0), Some(ETHEREUM_CHAIN_ID));
        assert_eq!(
            ChainAbstraction::get_chain_bridge_address(env.clone(), ETHEREUM_CHAIN_ID),
            Some(bridge)
        );
    }
}
