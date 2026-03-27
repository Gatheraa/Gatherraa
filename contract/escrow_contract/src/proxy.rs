#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec, Map, U256, i128, u64,
};

use crate::storage_types::{DataKey, EscrowContractConfig, EscrowStatus, Milestone, Dispute};

#[contract]
pub struct EscrowProxyContract;

#[contractimpl]
impl EscrowProxyContract {
    /// Initialize the escrow proxy with target contract addresses
    pub fn initialize(
        e: &Env,
        admin: Address,
        escrow_management_contract: Address,
        dispute_resolution_contract: Address,
        revenue_splitting_contract: Address,
        referral_tracking_contract: Address,
    ) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        let config = EscrowContractConfig {
            admin: admin.clone(),
            escrow_management_contract,
            dispute_resolution_contract,
            revenue_splitting_contract,
            referral_tracking_contract,
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

        let mut config: EscrowContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        match contract_type.to_string().as_str() {
            "escrow_management" => config.escrow_management_contract = new_address,
            "dispute_resolution" => config.dispute_resolution_contract = new_address,
            "revenue_splitting" => config.revenue_splitting_contract = new_address,
            "referral_tracking" => config.referral_tracking_contract = new_address,
            _ => panic!("invalid contract type"),
        }

        e.storage().instance().set(&DataKey::ContractConfig, &config);
    }

    /// Get current contract configuration
    pub fn get_config(e: &Env) -> EscrowContractConfig {
        e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap()
    }

    /// Proxy call to escrow management contract
    pub fn create_escrow_proxy(
        e: &Env,
        event: Address,
        organizer: Address,
        purchaser: Address,
        amount: i128,
        token: Address,
        release_time: u64,
    ) -> BytesN<32> {
        let config: EscrowContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // Generate escrow ID
        let escrow_id = Self::generate_escrow_id(e, &event, &purchaser, amount);
        
        // Store basic escrow info
        Self::store_basic_escrow(e, &escrow_id, event, organizer, purchaser, amount, token, release_time);
        
        escrow_id
    }

    /// Proxy call to dispute resolution contract
    pub fn create_dispute_proxy(
        e: &Env,
        escrow_id: BytesN<32>,
        complainant: Address,
        respondent: Address,
        reason: String,
        evidence: Vec<String>,
    ) -> u32 {
        let config: EscrowContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // Generate dispute ID
        let dispute_id = Self::generate_dispute_id(e, &escrow_id);
        
        // Store dispute info
        let dispute = Dispute {
            id: dispute_id,
            escrow_id: escrow_id.clone(),
            complainant: complainant.clone(),
            respondent: respondent.clone(),
            reason,
            evidence,
            status: EscrowStatus::Pending,
            created_at: e.ledger().timestamp(),
            resolved_at: None,
            resolution: None,
        };
        
        e.storage().persistent().set(&DataKey::Dispute(dispute_id), &dispute);
        
        dispute_id
    }

    /// Proxy call to revenue splitting contract
    pub fn calculate_revenue_split_proxy(
        e: &Env,
        amount: i128,
        organizer_percentage: u32,
        platform_percentage: u32,
        referral_percentage: u32,
    ) -> Map<Address, i128> {
        let total_percentage = organizer_percentage + platform_percentage + referral_percentage;
        if total_percentage > 10000 {
            panic!("Total percentage cannot exceed 100%");
        }

        let mut splits = Map::new(e);
        let precision = 10000;

        let organizer_amount = amount * organizer_percentage as i128 / precision;
        let platform_amount = amount * platform_percentage as i128 / precision;
        let referral_amount = amount * referral_percentage as i128 / precision;

        // These would be actual addresses in real implementation
        let organizer_addr = Address::generate(e);
        let platform_addr = Address::generate(e);
        let referral_addr = Address::generate(e);

        splits.set(organizer_addr, organizer_amount);
        splits.set(platform_addr, platform_amount);
        if referral_amount > 0 {
            splits.set(referral_addr, referral_amount);
        }

        splits
    }

    /// Proxy call to referral tracking contract
    pub fn track_referral_proxy(
        e: &Env,
        referrer: Address,
        purchaser: Address,
    ) -> bool {
        let config: EscrowContractConfig = e.storage()
            .instance()
            .get(&DataKey::ContractConfig)
            .unwrap();

        // Prevent self-referral
        if referrer == purchaser {
            return false;
        }

        // Store referral relationship
        let key = DataKey::ReferralTracker(referrer.clone());
        let referral_count = e.storage()
            .persistent()
            .get::<_, u32>(&key)
            .unwrap_or(0)
            .checked_add(1)
            .expect("Referral count overflow");

        e.storage().persistent().set(&key, &referral_count);

        true
    }

    /// Generate unique escrow ID
    fn generate_escrow_id(e: &Env, event: &Address, purchaser: &Address, amount: i128) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(event.clone());
        data.push_back(purchaser.clone());
        data.push_back(amount);
        e.crypto().sha256(&data)
    }

    /// Generate unique dispute ID
    fn generate_dispute_id(e: &Env, escrow_id: &BytesN<32>) -> u32 {
        let timestamp = e.ledger().timestamp();
        (timestamp + escrow_id.to_u256().low as u64) as u32 % 1000000
    }

    /// Store basic escrow information
    fn store_basic_escrow(
        e: &Env,
        escrow_id: &BytesN<32>,
        event: Address,
        organizer: Address,
        purchaser: Address,
        amount: i128,
        token: Address,
        release_time: u64,
    ) {
        let escrow_key = DataKey::Escrow(escrow_id.clone());
        
        // This would be a simplified Escrow struct
        e.storage().persistent().set(&escrow_key, &amount);
        e.storage().persistent().set(&DataKey::EscrowStatus(escrow_id.clone()), &EscrowStatus::Active);
        e.storage().persistent().set(&DataKey::EscrowReleaseTime(escrow_id.clone()), &release_time);
    }
}
