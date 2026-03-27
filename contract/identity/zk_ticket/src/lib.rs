#![no_std]
#![deny(clippy::all)]
#![deny(clippy::pedantic)]
#![warn(clippy::nursery)]
#![allow(clippy::module_name_repetitions)]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::cast_possible_truncation)]

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

// ─── ZK Ticket Constants ────────────────────────────────────────────────────────────

/// Minimum required byte length for a full ZK proof payload.
/// Proofs shorter than this are rejected as malformed.
const MIN_ZK_PROOF_DATA_LEN: u32 = 100;
/// Minimum required byte length for a mobile-optimized ZK proof payload.
/// Mobile proofs use a lighter format, so the threshold is lower.
const MIN_MOBILE_PROOF_DATA_LEN: u32 = 50;
/// TTL (in ledgers) for temporary mobile-proof storage.
/// Corresponds to approximately 5 minutes at 1-second ledger close times.
const MOBILE_PROOF_TTL_LEDGERS: u32 = 300;
/// Cache validity window in seconds for verification results (5 minutes).
const VERIFICATION_CACHE_TTL_SECONDS: u64 = 300;

/// The ZK Ticket Contract enables privacy-preserving ticket verification using Zero-Knowledge Proofs.
///
/// This contract allows event organizers to issue ticket commitments that users can later
/// prove ownership of without revealing their identity or sensitive ticket details, unless
/// specifically requested via selective disclosure.
#[contractimpl]
impl ZKTicketContract {
    /// Initializes the contract with the administrator and base circuit parameters.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `admin` - The address that will have administrative rights (pause, update params).
    /// * `circuit_params` - The cryptographic parameters for the ZK circuit.
    ///
    /// # Panics
    /// Panics if the contract is already initialized or if circuit parameters are invalid.
    pub fn initialize(env: Env, admin: Address, circuit_params: CircuitParameters) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        Self::validate_circuit_params(&circuit_params);

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CircuitParams, &circuit_params);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Version, &1u32);
        
        let revocation_list = RevocationList {
            revoked_commitments: Vec::new(&env),
            revoked_nullifiers: Vec::new(&env),
            last_updated: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::RevocationList, &revocation_list);
    }

    /// Creates a cryptographic commitment for a ticket. This is typically called by the event organizer.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `event_id` - The address of the associated event.
    /// * `ticket_hash` - A hash of the base ticket data.
    /// * `attributes` - A list of attributes to be committed to.
    /// * `nullifier` - A secret value that will be used to prevent double-spending.
    ///
    /// # Returns
    /// The unique commitment hash for the ticket.
    ///
    /// # Errors
    /// Returns [ZKTicketError::InsufficientAttributes] if mandatory attributes are missing.
    pub fn create_ticket_commitment(
        env: Env,
        event_id: Address,
        ticket_hash: BytesN<32>,
        attributes: Vec<ZKAttribute>,
        nullifier: BytesN<32>,
    ) -> Result<BytesN<32>, ZKTicketError> {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        Self::validate_attributes(&env, &attributes)?;

        let commitment = Self::calculate_commitment(&env, &ticket_hash, &attributes, &nullifier);

        let ticket_commitment = TicketCommitment {
            commitment: commitment.clone(),
            event_id: event_id.clone(),
            ticket_hash,
            created_at: env.ledger().timestamp(),
            nullifier: nullifier.clone(),
            attributes_hash: Self::calculate_attributes_hash(&env, &attributes),
            active: true,
        };

        env.storage().instance().set(&DataKey::TicketCommitment(commitment.clone()), &ticket_commitment);

        let event_key = DataKey::EventCommitments(event_id.clone());
        let mut event_commits: EventCommitments = env.storage().persistent().get(&event_key)
            .unwrap_or(EventCommitments {
                event_id: event_id.clone(),
                commitments: Vec::new(&env),
                total_tickets: 0,
                active_tickets: 0,
                created_at: env.ledger().timestamp(),
                circuit_params: Self::get_circuit_params(env.clone()),
            });

        event_commits.commitments.push_back(commitment.clone());
        event_commits.total_tickets = event_commits.total_tickets.checked_add(1).expect("Total tickets overflow");
        event_commits.active_tickets = event_commits.active_tickets.checked_add(1).expect("Active tickets overflow");
        env.storage().persistent().set(&event_key, &event_commits);

        let nullifier_info = NullifierInfo {
            nullifier: nullifier.clone(),
            used: false,
            used_at: None,
            proof_id: None,
        };
        env.storage().instance().set(&DataKey::Nullifier(nullifier.clone()), &nullifier_info);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("commitment_created"), commitment.clone()),
            (event_id, ticket_hash),
        );

        Ok(commitment)
    }

    /// Submits a ZK proof for verification. This is called by the ticket holder to prove ownership.
    ///
    /// # Arguments
    /// * `env` - The current contract environment.
    /// * `proof_id` - A unique identifier for the submission.
    /// * `ticket_commitment` - The commitment hash of the ticket.
    /// * `nullifier` - The secret nullifier revealed by the proof.
    /// * `event_id` - The address of the event.
    /// * `owner` - The address claiming ownership.
    /// * `attributes` - The attributes being verified.
    /// * `proof_data` - The raw cryptographic proof.
    /// * `expires_at` - When this verification should expire.
    ///
    /// # Returns
    /// `true` if verification is successful.
    ///
    /// # Errors
    /// Returns [ZKTicketError::VerificationFailed] if the proof is invalid.
    pub fn submit_proof(
        env: Env,
        proof_id: BytesN<32>,
        ticket_commitment: BytesN<32>,
        nullifier: BytesN<32>,
        event_id: Address,
        owner: Address,
        attributes: Vec<ZKAttribute>,
        proof_data: Vec<u8>,
        expires_at: u64,
    ) -> Result<bool, ZKTicketError> {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }

        // Validate all proof preconditions (commitment active, nullifier unused, not expired, not revoked)
        let (commitment, _nullifier_info) = Self::validate_proof_state(
            &env,
            &ticket_commitment,
            &nullifier,
            &event_id,
            expires_at,
        )?;

        let verification_hash = Self::verify_zk_proof(&env, &proof_data, &attributes, &commitment)?;
        
        let zk_proof = ZKProof {
            proof_id: proof_id.clone(),
            ticket_commitment: ticket_commitment.clone(),
            nullifier: nullifier.clone(),
            event_id: event_id.clone(),
            owner: owner.clone(),
            attributes: attributes.clone(),
            proof_data: proof_data.clone(),
            verification_hash,
            created_at: env.ledger().timestamp(),
            verified_at: Some(env.ledger().timestamp()),
            expires_at,
            revoked: false,
            batch_id: None,
        };

        env.storage().instance().set(&DataKey::ZKProof(proof_id.clone()), &zk_proof);

        let mut updated_nullifier = _nullifier_info;
        updated_nullifier.used = true;
        updated_nullifier.used_at = Some(env.ledger().timestamp());
        updated_nullifier.proof_id = Some(proof_id.clone());
        env.storage().instance().set(&DataKey::Nullifier(nullifier.clone()), &updated_nullifier);

        let user_key = DataKey::UserProofs(owner.clone());
        let mut user_proofs: Vec<BytesN<32>> = env.storage().persistent().get(&user_key).unwrap_or(Vec::new(&env));
        user_proofs.push_back(proof_id.clone());
        env.storage().persistent().set(&user_key, &user_proofs);

        Self::cache_verification_result(&env, &proof_id, true);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("proof_verified"), proof_id.clone()),
            (event_id, owner),
        );

        Ok(true)
    }

    /// Performs batch verification for a set of proofs. Optimized for event entry points.
    ///
    /// # Arguments
    /// * `e` - The current contract environment.
    /// * `proof_ids` - A list of unique proof IDs to verify.
    ///
    /// # Returns
    /// The ID of the batch verification record.
    pub fn batch_verify(e: Env, proof_ids: Vec<BytesN<32>>) -> BytesN<32> {
        let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        let batch_id = Self::generate_batch_id(&e, &proof_ids);

        let mut batch = BatchVerification {
            batch_id: batch_id.clone(),
            proofs: proof_ids.clone(),
            results: Vec::new(&e),
            created_at: e.ledger().timestamp(),
            completed_at: None,
            status: BatchStatus::Processing,
        };

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

    /// Verifies a proof optimized for mobile device constraints.
    pub fn verify_mobile_proof(
        env: Env,
        mobile_device_id: BytesN<32>,
        proof_template: Vec<u8>,
        proof_data: Vec<u8>,
        expires_at: u64,
    ) -> Result<bool, ZKTicketError> {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            panic!("contract is paused");
        }

        if env.ledger().timestamp() > expires_at {
            panic!("proof expired");
        }

        let verification_result = Self::verify_mobile_proof_internal(&env, &proof_template, &proof_data)?;

        let mut mobile_data: MobileProofData = env.storage().temporary().get(&mobile_device_id)
            .unwrap_or(MobileProofData {
                mobile_device_id: mobile_device_id.clone(),
                proof_template: proof_template.clone(),
                last_used: 0,
                usage_count: 0,
            });

        mobile_data.last_used = env.ledger().timestamp();
        mobile_data.usage_count = mobile_data.usage_count.checked_add(1).expect("Usage count overflow");

        env.storage().temporary().set(&mobile_device_id, &mobile_data, MOBILE_PROOF_TTL_LEDGERS);

        Ok(verification_result)
    }

    /// Selectively reveals previously hidden attributes for a verified proof.
    ///
    /// # Arguments
    /// * `e` - The current contract environment.
    /// * `proof_id` - The ID of the existing proof.
    /// * `attribute_types` - The types of attributes to reveal.
    /// * `reveal_data` - The raw values for the revealed attributes.
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

        if attribute_types.len() != reveal_data.len() {
            panic!("attribute count mismatch");
        }

        for (i, attr_type) in attribute_types.iter().enumerate() {
            if let Some(attr) = proof.attributes.iter_mut().find(|a| a.attribute_type == *attr_type) {
                attr.revealed = true;
                attr.value = reveal_data.get(i).unwrap().clone();
            }
        }

        e.storage().instance().set(&DataKey::ZKProof(proof_id.clone()), &proof);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("attributes_revealed"), proof_id.clone()),
            attribute_types.len(),
        );

        true
    }

    /// Manually revokes a ticket commitment, rendering it unusable for future proofs.
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

        let mut revocation_list: RevocationList = e.storage().instance().get(&DataKey::RevocationList).unwrap();
        revocation_list.revoked_commitments.push_back(ticket_commitment.clone());
        revocation_list.last_updated = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::RevocationList, &revocation_list);

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

    /// Pauses the contract, disabling core functionality.
    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    /// Unpauses the contract.
    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    /// Updates the global circuit parameters used for proof verification.
    pub fn update_circuit_params(e: Env, new_params: CircuitParameters) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        Self::validate_circuit_params(&new_params);
        e.storage().instance().set(&DataKey::CircuitParams, &new_params);
    }

    /// Retrieves a ZK Proof record by ID.
    pub fn get_proof(e: Env, proof_id: BytesN<32>) -> ZKProof {
        e.storage().instance().get(&DataKey::ZKProof(proof_id))
            .unwrap_or_else(|| panic!("proof not found"))
    }

    /// Retrieves a ticket commitment by its hash.
    pub fn get_commitment(e: Env, commitment: BytesN<32>) -> TicketCommitment {
        e.storage().instance().get(&DataKey::TicketCommitment(commitment))
            .unwrap_or_else(|| panic!("commitment not found"))
    }

    /// Retrieves nullifier usage information.
    pub fn get_nullifier_info(e: Env, nullifier: BytesN<32>) -> NullifierInfo {
        e.storage().instance().get(&DataKey::Nullifier(nullifier))
            .unwrap_or_else(|| panic!("nullifier not found"))
    }

    /// Retrieves all commitments for a specific event.
    pub fn get_event_commitments(e: Env, event_id: Address) -> EventCommitments {
        e.storage().persistent().get(&DataKey::EventCommitments(event_id))
            .unwrap_or_else(|| panic!("event commitments not found"))
    }

    /// Retrieves batch verification results.
    pub fn get_batch_verification(e: Env, batch_id: BytesN<32>) -> BatchVerification {
        e.storage().instance().get(&DataKey::BatchVerification(batch_id))
            .unwrap_or_else(|| panic!("batch not found"))
    }

    /// Retrieves all proof IDs submitted by a specific user.
    pub fn get_user_proofs(e: Env, user: Address) -> Vec<BytesN<32>> {
        e.storage().persistent().get(&DataKey::UserProofs(user))
            .unwrap_or(Vec::new(&e))
    }

    /// Retrieves the global revocation list.
    pub fn get_revocation_list(e: Env) -> RevocationList {
        e.storage().instance().get(&DataKey::RevocationList).unwrap()
    }

    /// Retrieves the current circuit parameters.
    pub fn get_circuit_params(e: Env) -> CircuitParameters {
        e.storage().instance().get(&DataKey::CircuitParams).unwrap()
    }

    /// Returns the contract logic version.
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

    /// Validates that a proof submission is allowed by checking commitment state, nullifier,
    /// expiry, and revocation. Returns `(commitment, nullifier_info)` on success.
    fn validate_proof_state(
        env: &Env,
        ticket_commitment: &BytesN<32>,
        nullifier: &BytesN<32>,
        event_id: &Address,
        expires_at: u64,
    ) -> Result<(TicketCommitment, NullifierInfo), ZKTicketError> {
        let commitment: TicketCommitment = env
            .storage()
            .instance()
            .get(&DataKey::TicketCommitment(ticket_commitment.clone()))
            .unwrap_or_else(|| panic!("commitment not found"));

        if !commitment.active {
            panic!("commitment inactive");
        }

        if commitment.event_id != *event_id {
            panic!("event mismatch");
        }

        let nullifier_info: NullifierInfo = env
            .storage()
            .instance()
            .get(&DataKey::Nullifier(nullifier.clone()))
            .unwrap_or_else(|| panic!("nullifier not found"));

        if nullifier_info.used {
            panic!("nullifier already used");
        }

        if env.ledger().timestamp() > expires_at {
            panic!("proof expired");
        }

        let revocation_list: RevocationList =
            env.storage().instance().get(&DataKey::RevocationList).unwrap();
        if revocation_list.revoked_commitments.contains(ticket_commitment) {
            panic!("ticket revoked");
        }

        Ok((commitment, nullifier_info))
    }

    pub(crate) fn validate_attributes(e: &Env, attributes: &Vec<ZKAttribute>) -> Result<(), ZKTicketError> {
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
        if proof_data.len() < MIN_ZK_PROOF_DATA_LEN {
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

    fn verify_single_proof(env: &Env, proof_id: &BytesN<32>) -> bool {
        let proof_opt: Option<ZKProof> = env.storage().instance().get(&DataKey::ZKProof(proof_id.clone()));
        if proof_opt.is_none() {
            return false;
        }
        let proof = proof_opt.unwrap();

        if proof.revoked || env.ledger().timestamp() > proof.expires_at {
            return false;
        }

        // Check verification cache
        let cache_key = Self::generate_cache_key(env, proof_id);
        if let Some(cached) = env.storage().instance().get(&DataKey::VerificationCache) {
            let cache_typed: VerificationCache = cached;
            let elapsed = env.ledger().timestamp().checked_sub(cache_typed.timestamp).expect("Time error");
            if cache_typed.cache_key == cache_key && elapsed < VERIFICATION_CACHE_TTL_SECONDS { // 5 minute cache
                return cache_typed.result;
            }
        }

        // Perform verification
        let commitment_opt: Option<TicketCommitment> = env.storage().instance().get(&DataKey::TicketCommitment(proof.ticket_commitment.clone()));
        if commitment_opt.is_none() {
            return false;
        }

        let verification_result = Self::verify_zk_proof(env, &proof.proof_data, &proof.attributes, &commitment_opt.unwrap()).is_ok();

        // Cache result
        Self::cache_verification_result(env, proof_id, verification_result);

        verification_result
    }

    fn verify_mobile_proof_internal(e: &Env, proof_template: &Vec<u8>, proof_data: &Vec<u8>) -> Result<bool, ZKTicketError> {
        // Simplified mobile verification - optimized for mobile devices
        if proof_data.len() < MIN_MOBILE_PROOF_DATA_LEN {
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
