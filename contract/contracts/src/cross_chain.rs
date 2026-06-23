use soroban_sdk::{contract, contractimpl, Address, Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec};

use crate::storage::{StorageCache, *};
use crate::types::{ChainConfig, Config, CrossChainMessage, DataKey, Tier, UserInfo};

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

    /// Add or remove a bridge validator authorized to attest messages from a source chain.
    pub fn set_bridge_validator(env: Env, source_chain_id: u32, validator: Address, active: bool) {
        let config = read_config(&env);
        config.admin.require_auth();

        read_chain_config(&env, source_chain_id)
            .unwrap_or_else(|| panic!("source chain not supported"));

        write_bridge_validator(&env, source_chain_id, &validator, active);
        extend_instance(&env);

        env.events().publish(
            (symbol_short!("br_val"), source_chain_id, validator.clone()),
            active,
        );
    }

    /// Check whether an address is configured as a validator for a source chain.
    pub fn is_bridge_validator(env: Env, source_chain_id: u32, validator: Address) -> bool {
        read_bridge_validator(&env, source_chain_id, &validator)
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
            Self::handle_cross_chain_stake(
                &env,
                user,
                amount,
                lock_duration,
                tier_id,
                target_chain,
            );
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
                env.events()
                    .publish((symbol_short!("stake_transfer_success"),), amount);
            }
            _ => {
                env.storage().instance().remove(&REENTRANCY_GUARD);
                env.events()
                    .publish((symbol_short!("stake_transfer_failed"),), amount);
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
        let chain_config = Self::assert_source_chain_active(&env, source_chain_id);

        if !Self::verify_cross_chain_message(
            &env,
            source_chain_id,
            Some(&chain_config.bridge_address),
            &message_data,
            &proof,
        ) {
            return;
        }

        Self::execute_verified_cross_chain_message(&env, &message_data);
    }

    /// Process an incoming message attested by a configured source-chain bridge validator.
    pub fn process_cross_chain_message_with_validator(
        env: Env,
        source_chain_id: u32,
        validator: Address,
        message_data: Vec<u8>,
        proof: Vec<u8>,
    ) {
        Self::assert_source_chain_active(&env, source_chain_id);

        if !Self::verify_cross_chain_message(
            &env,
            source_chain_id,
            Some(&validator),
            &message_data,
            &proof,
        ) {
            return;
        }

        Self::execute_verified_cross_chain_message(&env, &message_data);
    }

    fn execute_verified_cross_chain_message(env: &Env, message_data: &Vec<u8>) {
        let message = Self::parse_cross_chain_message(&message_data);
        match message.message_type {
            MESSAGE_TYPE_STAKE => Self::execute_cross_chain_stake(env, message),
            MESSAGE_TYPE_UNSTAKE => Self::execute_cross_chain_unstake(env, message),
            MESSAGE_TYPE_REWARD => Self::execute_cross_chain_reward(env, message),
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
        env.storage()
            .instance()
            .set(&DataKey::MessageNonce, &new_nonce);
        new_nonce
    }

    /// Verify cross-chain message authenticity
    fn verify_cross_chain_message(
        env: &Env,
        source_chain_id: u32,
        validator: Option<&Address>,
        message_data: &Vec<u8>,
        proof: &Vec<u8>,
    ) -> bool {
        let message_hash = Self::hash_cross_chain_message(env, message_data);

        // Proof format: exactly SHA-256(message_data). The actual signer/PoP check
        // is the Soroban Address authorization below. Bridge validators must sign
        // the canonical args (source_chain_id, message_hash), which lets account
        // and custom-account validators use the host's signature/auth verification.
        if proof.is_empty() {
            Self::emit_message_rejected(
                env,
                source_chain_id,
                symbol_short!("no_proof"),
                &message_hash,
            );
            return false;
        }

        if proof.len() != 32 {
            Self::emit_message_rejected(
                env,
                source_chain_id,
                symbol_short!("malform"),
                &message_hash,
            );
            return false;
        }

        if !Self::proof_matches_hash(proof, &message_hash) {
            Self::emit_message_rejected(
                env,
                source_chain_id,
                symbol_short!("bad_hash"),
                &message_hash,
            );
            return false;
        }

        let Some(validator) = validator else {
            Self::emit_message_rejected(
                env,
                source_chain_id,
                symbol_short!("no_val"),
                &message_hash,
            );
            return false;
        };

        if !read_bridge_validator(env, source_chain_id, validator) {
            Self::emit_message_rejected(
                env,
                source_chain_id,
                symbol_short!("no_val"),
                &message_hash,
            );
            return false;
        }

        validator.require_auth_for_args(Self::validator_auth_args(
            env,
            source_chain_id,
            &message_hash,
        ));
        Self::emit_message_verified(env, source_chain_id, validator, &message_hash);
        true
    }

    fn assert_source_chain_active(env: &Env, source_chain_id: u32) -> ChainConfig {
        let chain_config = read_chain_config(env, source_chain_id)
            .unwrap_or_else(|| panic!("source chain not supported"));

        if !chain_config.active {
            panic!("source chain is not active");
        }

        chain_config
    }

    fn hash_cross_chain_message(env: &Env, message_data: &Vec<u8>) -> BytesN<32> {
        env.crypto()
            .sha256(&Self::vec_to_bytes(env, message_data))
            .to_bytes()
    }

    fn vec_to_bytes(env: &Env, data: &Vec<u8>) -> Bytes {
        let mut bytes = Bytes::new(env);
        for byte in data.iter() {
            bytes.push_back(byte);
        }
        bytes
    }

    fn proof_matches_hash(proof: &Vec<u8>, message_hash: &BytesN<32>) -> bool {
        for index in 0u32..32 {
            if proof.get(index) != message_hash.get(index) {
                return false;
            }
        }
        true
    }

    fn validator_auth_args(env: &Env, source_chain_id: u32, message_hash: &BytesN<32>) -> Vec<Val> {
        let mut args = Vec::new(env);
        args.push_back(source_chain_id.into_val(env));
        args.push_back(message_hash.clone().into_val(env));
        args
    }

    fn emit_message_verified(
        env: &Env,
        source_chain_id: u32,
        validator: &Address,
        message_hash: &BytesN<32>,
    ) {
        env.events().publish(
            (symbol_short!("cc_verify"), source_chain_id),
            (validator.clone(), message_hash.clone()),
        );
    }

    fn execute_cross_chain_unstake(env: &Env, message: CrossChainMessage) {
        env.events()
            .publish((symbol_short!("cc_unstk"), message.sender), message.nonce);
    }

    fn execute_cross_chain_reward(env: &Env, message: CrossChainMessage) {
        env.events()
            .publish((symbol_short!("cc_reward"), message.sender), message.nonce);
    }

    fn emit_message_rejected(
        env: &Env,
        source_chain_id: u32,
        reason: Symbol,
        message_hash: &BytesN<32>,
    ) {
        env.events().publish(
            (symbol_short!("cc_reject"), source_chain_id),
            (reason, message_hash.clone()),
        );
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::{write_bridge_validator, write_chain_config, write_config};
    use soroban_sdk::{
        symbol_short,
        testutils::{Address as _, Events},
    };

    const SOURCE_CHAIN_ID: u32 = 7;

    fn setup_contract() -> (Env, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let validator = Address::generate(&env);
        let token = Address::generate(&env);
        let contract_id = env.register(CrossChainStakingContract, ());

        env.as_contract(&contract_id, || {
            write_config(
                &env,
                &Config {
                    admin: admin.clone(),
                    staking_token: token.clone(),
                    reward_token: token,
                    reward_rate: 1,
                    chain_id: 1,
                },
            );
            write_chain_config(
                &env,
                SOURCE_CHAIN_ID,
                &ChainConfig {
                    chain_id: SOURCE_CHAIN_ID,
                    chain_name: symbol_short!("source"),
                    bridge_address: validator.clone(),
                    gas_limit: 100_000,
                    confirmations: 3,
                    active: true,
                },
            );
            write_bridge_validator(&env, SOURCE_CHAIN_ID, &validator, true);
        });

        (env, validator, contract_id)
    }

    fn message_data(env: &Env) -> Vec<u8> {
        Vec::from_array(env, [1u8, 2, 3, 4])
    }

    fn proof_for(env: &Env, message_data: &Vec<u8>) -> Vec<u8> {
        let message_hash = CrossChainStakingContract::hash_cross_chain_message(env, message_data);
        let mut proof = Vec::new(env);
        for index in 0u32..32 {
            proof.push_back(message_hash.get(index).unwrap());
        }
        proof
    }

    fn has_event(env: &Env, event_name: Symbol) -> bool {
        let event_name: Val = event_name.into_val(env);
        env.events()
            .all()
            .iter()
            .any(|(_, topics, _)| topics.get(0) == Some(event_name))
    }

    #[test]
    fn valid_validator_proof_is_verified() {
        let (env, validator, contract_id) = setup_contract();
        let client = CrossChainStakingContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let message = message_data(&env);
        let proof = proof_for(&env, &message);

        client.process_cross_chain_message_with_validator(
            &SOURCE_CHAIN_ID,
            &validator,
            &message,
            &proof,
        );

        assert!(has_event(&env, symbol_short!("cc_verify")));
        assert!(!has_event(&env, symbol_short!("cc_reject")));
        assert_eq!(env.auths().len(), 1);
        assert_eq!(env.auths()[0].0, validator);
    }

    #[test]
    fn invalid_hash_proof_is_rejected() {
        let (env, validator, contract_id) = setup_contract();
        let client = CrossChainStakingContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let message = message_data(&env);
        let mut proof = proof_for(&env, &message);
        proof.set(0, proof.get(0).unwrap() ^ 1);

        client.process_cross_chain_message_with_validator(
            &SOURCE_CHAIN_ID,
            &validator,
            &message,
            &proof,
        );

        assert!(has_event(&env, symbol_short!("cc_reject")));
        assert!(!has_event(&env, symbol_short!("cc_verify")));
        assert!(env.auths().is_empty());
    }

    #[test]
    fn empty_proof_is_rejected() {
        let (env, validator, contract_id) = setup_contract();
        let client = CrossChainStakingContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        client.process_cross_chain_message_with_validator(
            &SOURCE_CHAIN_ID,
            &validator,
            &message_data(&env),
            &Vec::new(&env),
        );

        assert!(has_event(&env, symbol_short!("cc_reject")));
        assert!(!has_event(&env, symbol_short!("cc_verify")));
        assert!(env.auths().is_empty());
    }

    #[test]
    fn malformed_proof_is_rejected() {
        let (env, validator, contract_id) = setup_contract();
        let client = CrossChainStakingContractClient::new(&env, &contract_id);
        env.mock_all_auths();

        let malformed_proof = Vec::from_array(&env, [1u8, 2, 3]);
        client.process_cross_chain_message_with_validator(
            &SOURCE_CHAIN_ID,
            &validator,
            &message_data(&env),
            &malformed_proof,
        );

        assert!(has_event(&env, symbol_short!("cc_reject")));
        assert!(!has_event(&env, symbol_short!("cc_verify")));
        assert!(env.auths().is_empty());
    }
}
