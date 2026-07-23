#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum CrossContractError {
    NotImplemented = 1,
    InvalidChain = 2,
    BridgeFailed = 3,
    Unauthorized = 4,
    InvalidMessage = 5,
    MessageAlreadyExists = 6,
    MessageNotFound = 7,
    DuplicateNonce = 8,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainMessage {
    pub source_chain: BytesN<32>,
    pub target_chain: BytesN<32>,
    pub sender: Address,
    pub payload: Bytes,
    pub nonce: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    MessageByNonce(u64),
    LatestNonce,
}

#[contract]
pub struct CrossContractContract;

#[contractimpl]
impl CrossContractContract {
    /// Send a cross-chain message.
    ///
    /// Stores the message keyed by a monotonically increasing nonce and
    /// associates it with the caller.  Emits a `message_sent` event so
    /// relayers / bridge operators can pick it up.
    pub fn send_message(
        env: Env,
        target_chain: BytesN<32>,
        payload: Bytes,
    ) -> Result<u64, CrossContractError> {
        let sender = env.current_contract_address();

        if payload.is_empty() {
            return Err(CrossContractError::InvalidMessage);
        }

        let nonce = Self::next_nonce(&env);
        let source_chain = Self::own_chain_id(&env);

        let message = CrossChainMessage {
            source_chain,
            target_chain: target_chain.clone(),
            sender: sender.clone(),
            payload,
            nonce,
        };

        env.storage()
            .persistent()
            .set(&DataKey::MessageByNonce(nonce), &message);

        env.events().publish(
            (Symbol::new(&env, "message_sent"), nonce),
            (sender, target_chain),
        );

        Ok(nonce)
    }

    /// Receive a cross-chain message.
    ///
    /// Validates that the nonce has not been used before and that the message
    /// payload is non-empty.  Stores the message for later verification.
    pub fn receive_message(
        env: Env,
        message: CrossChainMessage,
    ) -> Result<(), CrossContractError> {
        if message.payload.is_empty() {
            return Err(CrossContractError::InvalidMessage);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::MessageByNonce(message.nonce))
        {
            return Err(CrossContractError::DuplicateNonce);
        }

        env.storage()
            .persistent()
            .set(&DataKey::MessageByNonce(message.nonce), &message);

        env.events().publish(
            (
                Symbol::new(&env, "message_received"),
                message.nonce,
            ),
            (message.sender, message.source_chain),
        );

        Ok(())
    }

    /// Verify that a message with the given nonce exists in storage.
    ///
    /// Returns the stored message if present, or `MessageNotFound` otherwise.
    pub fn verify_message(
        env: Env,
        nonce: u64,
    ) -> Result<CrossChainMessage, CrossContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::MessageByNonce(nonce))
            .ok_or(CrossContractError::MessageNotFound)
    }

    /// Retrieve a stored message by nonce.
    pub fn get_message(
        env: Env,
        nonce: u64,
    ) -> Result<CrossChainMessage, CrossContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::MessageByNonce(nonce))
            .ok_or(CrossContractError::MessageNotFound)
    }

    /// Return the next monotonically increasing nonce.
    fn next_nonce(env: &Env) -> u64 {
        let current: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LatestNonce)
            .unwrap_or(0);
        let next = current + 1;
        env.storage().instance().set(&DataKey::LatestNonce, &next);
        next
    }

    /// Placeholder: returns a fixed "own" chain identifier.
    fn own_chain_id(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }
}
