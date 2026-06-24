#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum CrossContractError {
    NotImplemented = 1,
    InvalidChain = 2,
    BridgeFailed = 3,
    Unauthorized = 4,
    InvalidMessage = 5,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainMessage {
    pub source_chain: BytesN<32>,
    pub target_chain: BytesN<32>,
    pub sender: Address,
    pub payload: Vec<u8>,
    pub nonce: u64,
}

#[contract]
pub struct CrossContractContract;

#[contractimpl]
impl CrossContractContract {
    pub fn send_message(
        env: Env,
        target_chain: BytesN<32>,
        payload: Vec<u8>,
    ) -> Result<u64, CrossContractError> {
        let _ = (env, target_chain, payload);
        Err(CrossContractError::NotImplemented)
    }

    pub fn receive_message(env: Env, message: CrossChainMessage) -> Result<(), CrossContractError> {
        let _ = (env, message);
        Err(CrossContractError::NotImplemented)
    }

    pub fn verify_message(env: Env, nonce: u64) -> Result<CrossChainMessage, CrossContractError> {
        let _ = (env, nonce);
        Err(CrossContractError::NotImplemented)
    }

    pub fn get_message(env: Env, nonce: u64) -> Result<CrossChainMessage, CrossContractError> {
        let _ = (env, nonce);
        Err(CrossContractError::NotImplemented)
    }
}
