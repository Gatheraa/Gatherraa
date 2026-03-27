#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec,
};

use crate::storage_types::{DataKey, TicketContractConfig};

#[contract]
pub struct TicketProxyContract;

#[contractimpl]
impl TicketProxyContract {
    /// Initialize the proxy contract with target contract addresses
    pub fn initialize(
        e: &Env,
        admin: Address,
        pricing_contract: Address,
        allocation_contract: Address,
        vrf_contract: Address,
        commitment_contract: Address,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        let config = TicketContractConfig {
            admin: admin.clone(),
            pricing_contract,
            allocation_contract,
            vrf_contract,
            commitment_contract,
        };

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::ContractConfig, &config);
        e.storage().instance().set(&DataKey::Version, &1u32);
    }

    /// Update target contract address
    pub fn update_contract(
        e: &Env,
        contract_type: Symbol,
        new_address: Address,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut config: TicketContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        match contract_type.to_string().as_str() {
            "pricing" => config.pricing_contract = new_address,
            "allocation" => config.allocation_contract = new_address,
            "vrf" => config.vrf_contract = new_address,
            "commitment" => config.commitment_contract = new_address,
            _ => panic!("invalid contract type"),
        }

        e.storage().instance().set(&DataKey::ContractConfig, &config);
    }

    /// Get current contract configuration
    pub fn get_config(e: &Env) -> TicketContractConfig {
        e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap()
    }

    /// Proxy call to pricing contract
    pub fn calculate_price(
        e: &Env,
        base_price: i128,
        tier: u32,
        quantity: u32,
    ) -> i128 {
        let config: TicketContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // This would invoke the pricing contract
        // For now, return base implementation
        base_price
    }

    /// Proxy call to allocation contract
    pub fn allocate_tickets(
        e: &Env,
        user: Address,
        quantity: u32,
        preferences: Vec<u32>,
    ) -> Vec<u32> {
        let config: TicketContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // This would invoke the allocation contract
        // For now, return empty allocation
        Vec::new(e)
    }

    /// Proxy call to VRF contract
    pub fn request_randomness(e: &Env, seed: BytesN<32>) -> BytesN<32> {
        let config: TicketContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // This would invoke the VRF contract
        // For now, return deterministic hash
        seed
    }

    /// Proxy call to commitment contract
    pub fn create_commitment(
        e: &Env,
        value: BytesN<32>,
        salt: BytesN<32>,
    ) -> BytesN<32> {
        let config: TicketContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // This would invoke the commitment contract
        // For now, return simple hash
        value
    }
}
