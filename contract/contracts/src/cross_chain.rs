use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec};

use crate::storage::{StorageCache, *};
use crate::types::{Config, DataKey, Tier, UserInfo, ChainConfig, CrossChainMessage};

#[contract]
pub struct CrossChainStakingContract;

const PRECISION: i128 = 1_000_000_000;

/// Reentrancy guard key
const REENTRANCY_GUARD: Symbol = symbol_short!("reentrant");

/// Cross-chain message types
const MESSAGE_TYPE_STAKE: Symbol = symbol_short!("stake_msg");
const MESSAGE_TYPE_UNSTAKE: Symbol = symbol_short!("unstake_msg");
const MESSAGE_TYPE_REWARD: Symbol = symbol_short!("reward_msg");

#[contractimpl]
impl CrossChainStakingContract {
    /// Initialize contract with cross-chain support
    pub fn initialize(
        env: Env,
        admin: Address,
        staking_token: Address,
        reward_token: Address,
        reward_rate: i128,
        chain_id: u32,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&crate::types::DataKey::Config) {
            panic!("already initialized");
        }

        // Validate addresses
        Self::validate_address(&env, &admin);
        Self::validate_contract_address(&env, &staking_token);
        Self::validate_contract_address(&env, &reward_token);

        let config = Config {
            admin,
            staking_token,
            reward_token,
            reward_rate,
            chain_id,
        };
        write_config(&env, &config);
        write_last_update_time(&env, env.ledger().timestamp());
        env.storage().instance().set(&DataKey::Version, &1u32);
        extend_instance(&env);
    }

    /// Configure supported chains for cross-chain operations
    pub fn configure_chain(
        env: Env,
        chain_id: u32,
        chain_name: Symbol,
        bridge_address: Address,
        gas_limit: u32,
        confirmations: u32,
    ) {
        let config = read_config(&env);
        config.admin.require_auth();

        let chain_config = ChainConfig {
            chain_id,
            chain_name,
            bridge_address,
            gas_limit,
            confirmations,
            active: true,
        };
        write_chain_config(&env, chain_id, &chain_config);
        extend_instance(&env);
    }

    /// Enable/disable chain support
    pub fn set_chain_status(env: Env, chain_id: u32, active: bool) {
        let config = read_config(&env);
        config.admin.require_auth();

        if let Some(mut chain_config) = read_chain_config(&env, chain_id) {
            chain_config.active = active;
            write_chain_config(&env, chain_id, &chain_config);
            extend_instance(&env);
        }
    }

    /// Stake tokens with cross-chain support
    pub fn stake(
        env: Env,
        user: Address,
        amount: i128,
        lock_duration: u64,
        tier_id: u32,
        target_chain_id: Option<u32>,
    ) {
        // Reentrancy protection
        if env.storage().instance().has(&REENTRANCY_GUARD) {
            panic!("reentrant call detected");
        }
        env.storage().instance().set(&REENTRANCY_GUARD, &true);

        user.require_auth();
        if amount <= 0 {
            env.storage().instance().remove(&REENTRANCY_GUARD);
            panic!("amount must be > 0");
        }

        // Handle cross-chain staking
        if let Some(target_chain) = target_chain_id {
            Self::handle_cross_chain_stake(&env, user, amount, lock_duration, tier_id, target_chain);
            env.storage().instance().remove(&REENTRANCY_GUARD);
            return;
        }

        // Local staking logic (existing implementation)
        update_reward(&env, Some(&user));

        let mut cache = StorageCache::new();
        let config = cache.get_config(&env).clone();
        let tier = read_tier(&env, tier_id).unwrap_or(Tier {
            min_amount: 0,
            reward_multiplier: 100,
        });

        // Transfer tokens
        let token_client = token::Client::new(&env, &config.staking_token);
        let contract_address = env.current_contract_address();
        
        match token_client.try_transfer(&user, &contract_address, &amount) {
            Ok(Ok(())) => {
                env.events().publish((symbol_short!("stake_transfer_success"),), amount);
            },
            _ => {
                env.storage().instance().remove(&REENTRANCY_GUARD);
                env.events().publish((symbol_short!("stake_transfer_failed"),), amount);
                panic!("token transfer failed");
            }
        }

        // Update user info
        let mut user_info = read_user_info(&env, &user).unwrap_or(UserInfo {
            amount: 0,
            shares: 0,
            reward_per_token_paid: cache.get_reward_per_token_stored(&env),
            rewards: 0,
            lock_until: 0,
            tier_id,
        });

        user_info.amount += amount;
        user_info.lock_until = env.ledger().timestamp() + lock_duration;
        user_info.tier_id = tier_id;

        write_user_info(&env, &user, &user_info);
        env.storage().instance().remove(&REENTRANCY_GUARD);
        
        env.events().publish(
            (symbol_short!("stake"), user.clone()),
            (amount, tier_id, lock_duration),
        );
    }

    /// Handle cross-chain staking
    fn handle_cross_chain_stake(
        env: &Env,
        user: Address,
        amount: i128,
        lock_duration: u64,
        tier_id: u32,
        target_chain_id: u32,
    ) {
        let chain_config = read_chain_config(env, target_chain_id)
            .unwrap_or_else(|| panic!("target chain not configured"));

        if !chain_config.active {
            panic!("target chain is not active");
        }

        // Create cross-chain message
        let message = CrossChainMessage {
            message_type: MESSAGE_TYPE_STAKE,
            sender: user.clone(),
            target_chain: target_chain_id,
            data: (amount, lock_duration, tier_id),
            nonce: Self::generate_nonce(env),
            timestamp: env.ledger().timestamp(),
        };

        // Store pending message
        write_pending_message(env, &message);

        // Emit event for bridge to process
        env.events().publish(
            (symbol_short!("cross_chain_stake"), user),
            (target_chain_id, amount, message.nonce),
        );
    }

    /// Process incoming cross-chain message
    pub fn process_cross_chain_message(
        env: Env,
        source_chain_id: u32,
        message_data: Vec<u8>,
        proof: Vec<u8>,
    ) {
        // Verify chain is supported
        let chain_config = read_chain_config(&env, source_chain_id)
            .unwrap_or_else(|| panic!("source chain not supported"));

        if !chain_config.active {
            panic!("source chain is not active");
        }

        // Verify message authenticity (implementation depends on bridge)
        if !Self::verify_cross_chain_message(&env, source_chain_id, &message_data, &proof) {
            panic!("invalid cross-chain message");
        }

        // Parse and execute message
        let message = Self::parse_cross_chain_message(&message_data);
        match message.message_type {
            MESSAGE_TYPE_STAKE => Self::execute_cross_chain_stake(&env, message),
            MESSAGE_TYPE_UNSTAKE => Self::execute_cross_chain_unstake(&env, message),
            MESSAGE_TYPE_REWARD => Self::execute_cross_chain_reward(&env, message),
            _ => panic!("unsupported message type"),
        }
    }

    /// Execute cross-chain staking
    fn execute_cross_chain_stake(env: &Env, message: CrossChainMessage) {
        let (amount, lock_duration, tier_id): (i128, u64, u32) = message.data;

        // Update user info for cross-chain stake
        let mut user_info = read_user_info(env, &message.sender).unwrap_or(UserInfo {
            amount: 0,
            shares: 0,
            reward_per_token_paid: 0,
            rewards: 0,
            lock_until: 0,
            tier_id,
        });

        user_info.amount += amount;
        user_info.lock_until = env.ledger().timestamp() + lock_duration;
        user_info.tier_id = tier_id;

        write_user_info(env, &message.sender, &user_info);

        // Remove from pending messages
        remove_pending_message(env, message.nonce);

        env.events().publish(
            (symbol_short!("cross_chain_stake_executed"), message.sender),
            (amount, tier_id),
        );
    }

    /// Generate unique nonce for cross-chain messages
    fn generate_nonce(env: &Env) -> u64 {
        let current_nonce = env
            .storage()
            .instance()
            .get(&DataKey::MessageNonce)
            .unwrap_or(0u64);
        let new_nonce = current_nonce + 1;
        env.storage().instance().set(&DataKey::MessageNonce, &new_nonce);
        new_nonce
    }

    /// Verify cross-chain message authenticity
    fn verify_cross_chain_message(
        env: &Env,
        source_chain_id: u32,
        message_data: &Vec<u8>,
        proof: &Vec<u8>,
    ) -> bool {
        // This would integrate with the specific bridge protocol
        // For now, return true as placeholder
        // In production, this would verify cryptographic proofs
        true
    }

    /// Parse cross-chain message
    fn parse_cross_chain_message(message_data: &Vec<u8>) -> CrossChainMessage {
        // Implementation depends on serialization format
        // For now, return placeholder
        CrossChainMessage {
            message_type: MESSAGE_TYPE_STAKE,
            sender: Address::default(),
            target_chain: 0,
            data: (0, 0, 0),
            nonce: 0,
            timestamp: 0,
        }
    }

    /// Get supported chains
    pub fn get_supported_chains(env: Env) -> Vec<u32> {
        let chains_key = DataKey::SupportedChains;
        env.storage()
            .instance()
            .get(&chains_key)
            .unwrap_or_else(|| Vec::new(env))
    }

    /// Get chain configuration
    pub fn get_chain_config(env: Env, chain_id: u32) -> Option<ChainConfig> {
        read_chain_config(&env, chain_id)
    }

    /// Get pending cross-chain messages for user
    pub fn get_pending_messages(env: Env, user: Address) -> Vec<CrossChainMessage> {
        let pending_key = DataKey::PendingMessages(user);
        env.storage()
            .instance()
            .get(&pending_key)
            .unwrap_or_else(|| Vec::new(env))
    }

    /// Validate address format for current chain
    fn validate_address(env: &Env, address: &Address) {
        // Chain-specific address validation
        let config = read_config(env);
        match config.chain_id {
            1 => Self::validate_ethereum_address(address),
            2 => Self::validate_stellar_address(address),
            3 => Self::validate_polygon_address(address),
            _ => Self::validate_generic_address(address),
        }
    }

    /// Validate contract address
    fn validate_contract_address(env: &Env, address: &Address) {
        // Additional validation for contract addresses
        Self::validate_address(env, address);
    }

    /// Ethereum address validation
    fn validate_ethereum_address(address: &Address) {
        // Ethereum-specific validation logic
        // For now, basic validation
    }

    /// Stellar address validation
    fn validate_stellar_address(address: &Address) {
        // Stellar-specific validation logic
        // For now, basic validation
    }

    /// Polygon address validation
    fn validate_polygon_address(address: &Address) {
        // Polygon-specific validation logic
        // For now, basic validation
    }

    /// Generic address validation
    fn validate_generic_address(_address: &Address) {
        // Generic validation for unknown chains
    }
}
