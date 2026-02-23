#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, ZKProof, ZKAttribute, AttributeType, TicketCommitment, 
                   NullifierInfo, EventCommitments, CircuitParameters, VerificationCache,
                   RevocationList, BatchVerification, BatchStatus, MobileProofData, ZKTicketError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, map, Address, BytesN, Env, IntoVal, String, Symbol, Vec, Map, U256,
};

#[contract]
pub struct ZKTicketContract;

#[contractimpl]
impl ZKTicketContract {
    // Initialize the contract
    pub fn initialize(e: Env, admin: Address, circuit_params: CircuitParameters) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        // Validate circuit parameters
        Self::validate_circuit_params(&circuit_params);

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::CircuitParams, &circuit_params);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::Version, &1u32);
        
        // Initialize revocation list
        let revocation_list = RevocationList {
            revoked_commitments: Vec::new(&e),
            revoked_nullifiers: Vec::new(&e),
            last_updated: e.ledger().timestamp(),
        };
        e.storage().instance().set(&DataKey::RevocationList, &revocation_list);
    }

    // Create ticket commitment (off-chain preparation)
    pub fn create_ticket_commitment(
        e: Env,
        event_id: Address,
        ticket_hash: BytesN<32>,
        attributes: Vec<ZKAttribute>,
        nullifier: BytesN<32>,
    ) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Validate attributes
        Self::validate_attributes(&e, &attributes)?;

        // Calculate commitment
        let commitment = Self::calculate_commitment(&e, &ticket_hash, &attributes, &nullifier);

        let ticket_commitment = TicketCommitment {
            commitment: commitment.clone(),
            event_id: event_id.clone(),
            ticket_hash,
            created_at: e.ledger().timestamp(),
            nullifier: nullifier.clone(),
            attributes_hash: Self::calculate_attributes_hash(&e, &attributes),
            active: true,
        };

        // Store commitment
        e.storage().instance().set(&DataKey::TicketCommitment(commitment.clone()), &ticket_commitment);

        // Update event commitments
        let event_key = DataKey::EventCommitments(event_id.clone());
        let mut event_commits: EventCommitments = e.storage().persistent().get(&event_key)
            .unwrap_or(EventCommitments {
                event_id: event_id.clone(),
                commitments: Vec::new(&e),
                total_tickets: 0,
                active_tickets: 0,
                created_at: e.ledger().timestamp(),
                circuit_params: Self::get_circuit_params(e.clone()),
            });

        event_commits.commitments.push_back(commitment.clone());
        event_commits.total_tickets += 1;
        event_commits.active_tickets += 1;
        e.storage().persistent().set(&event_key, &event_commits);

        // Store nullifier info
        let nullifier_info = NullifierInfo {
            nullifier: nullifier.clone(),
            used: false,
            used_at: None,
            proof_id: None,
        };
        e.storage().instance().set(&DataKey::Nullifier(nullifier.clone()), &nullifier_info);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("commitment_created"), commitment.clone()),
            (event_id, ticket_hash),
        );

        commitment
    }

    // Submit and verify ZK proof
    pub fn submit_proof(
        e: Env,
        proof_id: BytesN<32>,
        ticket_commitment: BytesN<32>,
        nullifier: BytesN<32>,
        event_id: Address,
        owner: Address,
        attributes: Vec<ZKAttribute>,
        proof_data: Vec<u8>,
        expires_at: u64,
    ) -> bool {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Validate commitment exists and is active
        let commitment: TicketCommitment = e.storage().instance().get(&DataKey::TicketCommitment(ticket_commitment.clone()))
            .unwrap_or_else(|| panic!("commitment not found"));

        if !commitment.active {
            panic!("commitment inactive");
        }

        if commitment.event_id != event_id {
            panic!("event mismatch");
        }

        // Check nullifier not used
        let nullifier_info: NullifierInfo = e.storage().instance().get(&DataKey::Nullifier(nullifier.clone()))
            .unwrap_or_else(|| panic!("nullifier not found"));

        if nullifier_info.used {
            panic!("nullifier already used");
        }

        // Validate proof expiration
        if e.ledger().timestamp() > expires_at {
            panic!("proof expired");
        }

        // Check revocation list
        let revocation_list: RevocationList = e.storage().instance().get(&DataKey::RevocationList).unwrap();
        if revocation_list.revoked_commitments.contains(&ticket_commitment) {
            panic!("ticket revoked");
        }

        // Verify ZK proof
        let verification_hash = Self::verify_zk_proof(&e, &proof_data, &attributes, &commitment)?;
        
        // Create ZK proof record
        let zk_proof = ZKProof {
            proof_id: proof_id.clone(),
            ticket_commitment: ticket_commitment.clone(),
            nullifier: nullifier.clone(),
            event_id: event_id.clone(),
            owner: owner.clone(),
            attributes: attributes.clone(),
            proof_data: proof_data.clone(),
            verification_hash,
            created_at: e.ledger().timestamp(),
            verified_at: Some(e.ledger().timestamp()),
            expires_at,
            revoked: false,
            batch_id: None,
        };

        // Store proof
        e.storage().instance().set(&DataKey::ZKProof(proof_id.clone()), &zk_proof);

        // Mark nullifier as used
        let mut updated_nullifier = nullifier_info;
        updated_nullifier.used = true;
        updated_nullifier.used_at = Some(e.ledger().timestamp());
        updated_nullifier.proof_id = Some(proof_id.clone());
        e.storage().instance().set(&DataKey::Nullifier(nullifier.clone()), &updated_nullifier);

        // Add to user's proofs
        let user_key = DataKey::UserProofs(owner.clone());
        let mut user_proofs: Vec<BytesN<32>> = e.storage().persistent().get(&user_key).unwrap_or(Vec::new(&e));
        user_proofs.push_back(proof_id.clone());
        e.storage().persistent().set(&user_key, &user_proofs);

        // Cache verification result
        Self::cache_verification_result(&e, &proof_id, true);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("proof_verified"), proof_id.clone()),
            (event_id, owner),
        );

        true
    }

    // Batch verification for event entry
    pub fn batch_verify(e: Env, proof_ids: Vec<BytesN<32>) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Generate batch ID
        let batch_id = Self::generate_batch_id(&e, &proof_ids);

        let mut batch = BatchVerification {
            batch_id: batch_id.clone(),
            proofs: proof_ids.clone(),
            results: Vec::new(&e),
            created_at: e.ledger().timestamp(),
            completed_at: None,
            status: BatchStatus::Processing,
        };

        // Process each proof
        for proof_id in proof_ids.iter() {
            let result = Self::verify_single_proof(&e, proof_id);
            batch.results.push_back(result);
        }

        batch.status = BatchStatus::Completed;
        batch.completed_at = Some(e.ledger().timestamp());
        e.storage().instance().set(&DataKey::BatchVerification(batch_id.clone()), &batch);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("batch_completed"), batch_id.clone()),
            batch.results.len(),
        );

        batch_id
    }

    // Mobile-friendly proof verification
    pub fn verify_mobile_proof(
        e: Env,
        mobile_device_id: BytesN<32>,
        proof_template: Vec<u8>,
        proof_data: Vec<u8>,
        expires_at: u64,
    ) -> bool {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        // Validate expiration
        if e.ledger().timestamp() > expires_at {
            panic!("proof expired");
        }

        // Verify mobile proof (simplified verification for mobile devices)
        let verification_result = Self::verify_mobile_proof_internal(&e, &proof_template, &proof_data)?;

        // Update mobile proof data
        let mobile_data = MobileProofData {
            mobile_device_id: mobile_device_id.clone(),
            proof_template: proof_template.clone(),
            last_used: e.ledger().timestamp(),
            usage_count: 1,
        };

        // Store mobile data (could be persistent or temporary)
        e.storage().temporary().set(&mobile_device_id, &mobile_data, 300); // 5 minutes TTL

        verification_result
    }

    // Selective disclosure - reveal specific attributes
    pub fn reveal_attributes(
        e: Env,
        proof_id: BytesN<32>,
        attribute_types: Vec<AttributeType>,
        reveal_data: Vec<Vec<u8>>,
    ) -> bool {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        let mut proof: ZKProof = e.storage().instance().get(&DataKey::ZKProof(proof_id.clone()))
            .unwrap_or_else(|| panic!("proof not found"));

        if proof.revoked {
            panic!("proof revoked");
        }

        if e.ledger().timestamp() > proof.expires_at {
            panic!("proof expired");
        }

        // Validate attribute count
        if attribute_types.len() != reveal_data.len() {
            panic!("attribute count mismatch");
        }

        // Update revealed attributes
        for (i, attr_type) in attribute_types.iter().enumerate() {
            if let Some(attr) = proof.attributes.iter_mut().find(|a| a.attribute_type == *attr_type) {
                attr.revealed = true;
                attr.value = reveal_data.get(i).unwrap().clone();
            }
        }

        // Store updated proof
        e.storage().instance().set(&DataKey::ZKProof(proof_id.clone()), &proof);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("attributes_revealed"), proof_id.clone()),
            attribute_types.len(),
        );

        true
    }

    // Revoke a ticket/commitment
    pub fn revoke_ticket(e: Env, ticket_commitment: BytesN<32>, reason: Symbol) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut commitment: TicketCommitment = e.storage().instance().get(&DataKey::TicketCommitment(ticket_commitment.clone()))
            .unwrap_or_else(|| panic!("commitment not found"));

        if !commitment.active {
            panic!("commitment already inactive");
        }

        commitment.active = false;
        e.storage().instance().set(&DataKey::TicketCommitment(ticket_commitment.clone()), &commitment);

        // Add to revocation list
        let mut revocation_list: RevocationList = e.storage().instance().get(&DataKey::RevocationList).unwrap();
        revocation_list.revoked_commitments.push_back(ticket_commitment.clone());
        revocation_list.last_updated = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::RevocationList, &revocation_list);

        // Update event commitments
        let event_key = DataKey::EventCommitments(commitment.event_id.clone());
        let mut event_commits: EventCommitments = e.storage().persistent().get(&event_key).unwrap();
        event_commits.active_tickets = event_commits.active_tickets.saturating_sub(1);
        e.storage().persistent().set(&event_key, &event_commits);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("ticket_revoked"), ticket_commitment.clone()),
            reason,
        );
    }

    // Admin functions
    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn update_circuit_params(e: Env, new_params: CircuitParameters) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_circuit_params(&new_params);
        e.storage().instance().set(&DataKey::CircuitParams, &new_params);
    }

    // View functions
    pub fn get_proof(e: Env, proof_id: BytesN<32>) -> ZKProof {
        e.storage().instance().get(&DataKey::ZKProof(proof_id))
            .unwrap_or_else(|| panic!("proof not found"))
    }

    pub fn get_commitment(e: Env, commitment: BytesN<32>) -> TicketCommitment {
        e.storage().instance().get(&DataKey::TicketCommitment(commitment))
            .unwrap_or_else(|| panic!("commitment not found"))
    }

    pub fn get_nullifier_info(e: Env, nullifier: BytesN<32>) -> NullifierInfo {
        e.storage().instance().get(&DataKey::Nullifier(nullifier))
            .unwrap_or_else(|| panic!("nullifier not found"))
    }

    pub fn get_event_commitments(e: Env, event_id: Address) -> EventCommitments {
        e.storage().persistent().get(&DataKey::EventCommitments(event_id))
            .unwrap_or_else(|| panic!("event commitments not found"))
    }

    pub fn get_batch_verification(e: Env, batch_id: BytesN<32>) -> BatchVerification {
        e.storage().instance().get(&DataKey::BatchVerification(batch_id))
            .unwrap_or_else(|| panic!("batch not found"))
    }

    pub fn get_user_proofs(e: Env, user: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::UserProofs(user))
            .unwrap_or(Vec::new(&e))
    }

    pub fn get_revocation_list(e: Env) -> RevocationList {
        e.storage().instance().get(&DataKey::RevocationList).unwrap()
    }

    pub fn get_circuit_params(e: Env) -> CircuitParameters {
        e.storage().instance().get(&DataKey::CircuitParams).unwrap()
    }

    pub fn version(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Version).unwrap_or(1)
    }

    // Helper functions
    fn validate_circuit_params(params: &CircuitParameters) {
        if params.attribute_count == 0 {
            panic!("invalid attribute count");
        }

        if params.public_inputs == 0 || params.private_inputs == 0 {
            panic!("invalid input counts");
        }

        // In a real implementation, you'd validate the circuit hashes against known good circuits
    }

    fn validate_attributes(e: &Env, attributes: &Vec<ZKAttribute>) -> Result<(), ZKTicketError> {
        if attributes.is_empty() {
            return Err(ZKTicketError::InsufficientAttributes);
        }

        // Check for required attributes
        let has_ticket_id = attributes.iter().any(|a| matches!(a.attribute_type, AttributeType::TicketId));
        let has_event_id = attributes.iter().any(|a| matches!(a.attribute_type, AttributeType::EventId));

        if !has_ticket_id || !has_event_id {
            return Err(ZKTicketError::InsufficientAttributes);
        }

        Ok(())
    }

    fn calculate_commitment(e: &Env, ticket_hash: &BytesN<32>, attributes: &Vec<ZKAttribute>, nullifier: &BytesN<32>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(ticket_hash.to_val());
        data.push_back(nullifier.to_val());
        
        for attr in attributes.iter() {
            data.push_back(attr.commitment.to_val());
        }
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn calculate_attributes_hash(e: &Env, attributes: &Vec<ZKAttribute>) -> BytesN<32> {
        let mut data = Vec::new(e);
        
        for attr in attributes.iter() {
            data.push_back(attr.value.to_val());
        }
        
        e.crypto().sha256(&data.to_bytes())
    }

    fn verify_zk_proof(
        e: &Env,
        proof_data: &Vec<u8>,
        attributes: &Vec<ZKAttribute>,
        commitment: &TicketCommitment,
    ) -> Result<BytesN<32>, ZKTicketError> {
        // In a real implementation, this would use actual ZK proof verification
        // For now, we'll simulate verification with hash checks
        
        let circuit_params: CircuitParameters = e.storage().instance().get(&DataKey::CircuitParams).unwrap();
        
        // Verify proof format and structure
        if proof_data.len() < 100 {
            return Err(ZKTicketError::InvalidProof);
        }

        // Check proof against circuit parameters
        let proof_hash = e.crypto().sha256(&proof_data.to_bytes());
        
        // Simulate verification (in reality, this would be actual ZK verification)
        let verification_success = Self::simulate_zk_verification(e, proof_data, attributes, commitment);
        
        if !verification_success {
            return Err(ZKTicketError::VerificationFailed);
        }

        Ok(proof_hash)
    }

    fn simulate_zk_verification(
        e: &Env,
        proof_data: &Vec<u8>,
        attributes: &Vec<ZKAttribute>,
        commitment: &TicketCommitment,
    ) -> bool {
        // Simplified simulation - in reality this would be actual ZK verification
        let mut data = Vec::new(e);
        data.push_back(proof_data.to_val());
        data.push_back(commitment.commitment.to_val());
        
        for attr in attributes.iter() {
            data.push_back(attr.commitment.to_val());
        }
        
        let hash = e.crypto().sha256(&data.to_bytes());
        
        // Simple check: hash should not be all zeros (simulated successful verification)
        hash != BytesN::from_array(e, &[0; 32])
    }

    fn verify_single_proof(e: &Env, proof_id: &BytesN<32>) -> bool {
        let proof: ZKProof = e.storage().instance().get(&DataKey::ZKProof(proof_id.clone()))
            .unwrap_or_else(|| false);

        if proof.revoked || e.ledger().timestamp() > proof.expires_at {
            return false;
        }

        // Check verification cache
        let cache_key = Self::generate_cache_key(e, proof_id);
        if let Some(cached) = e.storage().instance().get(&DataKey::VerificationCache) {
            if cached.cache_key == cache_key && 
               e.ledger().timestamp() - cached.timestamp < 300 { // 5 minute cache
                return cached.result;
            }
        }

        // Perform verification
        let verification_result = Self::verify_zk_proof(e, &proof.proof_data, &proof.attributes, 
                                                      &e.storage().instance().get(&DataKey::TicketCommitment(proof.ticket_commitment.clone())).unwrap()).is_ok();

        // Cache result
        Self::cache_verification_result(e, proof_id, verification_result);

        verification_result
    }

    fn verify_mobile_proof_internal(e: &Env, proof_template: &Vec<u8>, proof_data: &Vec<u8>) -> Result<bool, ZKTicketError> {
        // Simplified mobile verification - optimized for mobile devices
        if proof_data.len() < 50 {
            return Err(ZKTicketError::MobileVerificationFailed);
        }

        // Quick hash-based verification for mobile
        let template_hash = e.crypto().sha256(&proof_template.to_bytes());
        let proof_hash = e.crypto().sha256(&proof_data.to_bytes());
        
        // Simple validation
        Ok(template_hash != BytesN::from_array(e, &[0; 32]) && 
           proof_hash != BytesN::from_array(e, &[0; 32]))
    }

    fn cache_verification_result(e: &Env, proof_id: &BytesN<32>, result: bool) {
        let cache_key = Self::generate_cache_key(e, proof_id);
        let cache = VerificationCache {
            cache_key,
            result,
            timestamp: e.ledger().timestamp(),
            proof_id: proof_id.clone(),
        };
        e.storage().instance().set(&DataKey::VerificationCache, &cache);
    }

    fn generate_cache_key(e: &Env, proof_id: &BytesN<32>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(proof_id.to_val());
        data.push_back(e.ledger().timestamp().to_val());
        e.crypto().sha256(&data.to_bytes())
    }

    fn generate_batch_id(e: &Env, proof_ids: &Vec<BytesN<32>) -> BytesN<32> {
        let mut data = Vec::new(e);
        data.push_back(proof_ids.len().into_val(e));
        data.push_back(e.ledger().timestamp().to_val());
        
        for proof_id in proof_ids.iter() {
            data.push_back(proof_id.to_val());
        }
        
        e.crypto().sha256(&data.to_bytes())
    }
}
