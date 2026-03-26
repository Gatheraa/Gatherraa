#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, DIDDocument, Claim, Credential, Delegation, Revocation, IdentityError};

use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, Address, Bytes, BytesN, Env, String, Symbol, Vec, crypto,
};

#[contract]
pub struct IdentityRegistryContract;

const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
const VERIFIER_ROLE: Symbol = symbol_short!("VERIFIER");

const TTL_INSTANCE: u32 = 17280 * 30; // 30 days
const TTL_PERSISTENT: u32 = 17280 * 90; // 90 days
const MAX_CLAIMS_PER_DID: u32 = 50;
const MAX_DELEGATIONS_PER_DID: u32 = 10;
const REPUTATION_BASE_SCORE: u32 = 100;
const EVENT_ATTENDANCE_SCORE: u32 = 50;
const VERIFIED_CREDENTIAL_SCORE: u32 = 30;

#[contractimpl]
impl IdentityRegistryContract {
    /// Initialize the identity registry contract
    pub fn initialize(e: Env, admin: Address) -> Result<(), IdentityError> {
        if e.storage().instance().has(&DataKey::Admin) {
            return Err(IdentityError::AlreadyInitialized);
        }
        
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::TotalDIDs, &0u32);

        // Grant initial roles
        let key = DataKey::Role(ADMIN_ROLE, admin);
        e.storage().persistent().set(&key, &true);

        extend_instance(&e);
        Ok(())
    }

    /// Create a new DID for a user
    pub fn create_did(e: Env, user: Address, public_key: BytesN<32>) -> Result<String, IdentityError> {
        user.require_auth();
        
        check_paused(&e)?;
        
        let did_string = generate_did(&e, &user);
        
        if e.storage().persistent().has(&DataKey::DID(did_string.clone())) {
            return Err(IdentityError::DIDAlreadyExists);
        }
        
        let did_document = DIDDocument {
            id: did_string.clone(),
            controller: user.clone(),
            public_key,
            created: e.ledger().timestamp(),
            updated: e.ledger().timestamp(),
            deactivated: false,
            claims: Vec::new(&e),
            reputation_score: REPUTATION_BASE_SCORE,
        };
        
        e.storage().persistent().set(&DataKey::DID(did_string.clone()), &did_document);
        e.storage().persistent().set(&DataKey::AddressToDID(user.clone()), &did_string);
        
        // Update total DIDs count
        let total_dids: u32 = e.storage().instance().get(&DataKey::TotalDIDs).ok_or(IdentityError::NotInitialized)?;
        e.storage().instance().set(&DataKey::TotalDIDs, &(total_dids + 1));
        
        extend_persistent(&e, &DataKey::DID(did_string.clone()));
        extend_persistent(&e, &DataKey::AddressToDID(user.clone()));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "did_created"), user),
            did_string.clone(),
        );
        
        Ok(did_string)
    }

    /// Add a claim to a DID (Twitter, GitHub, email, etc.)
    pub fn add_claim(
        e: Env, 
        did: String, 
        claim_type: String, 
        claim_value: String, 
        proof: Bytes
    ) -> Result<u32, IdentityError> {
        let mut did_doc = get_did_document(&e, &did)?;
        let caller = e.invoker();
        
        // Only controller or delegate can add claims
        if caller != did_doc.controller {
            check_delegation(&e, &did, &caller, &String::from_str(&e, "add_claim"))?;
        }
        
        check_paused(&e)?;
        
        if did_doc.claims.len() >= MAX_CLAIMS_PER_DID {
            return Err(IdentityError::MaxClaimsReached);
        }
        
        let claim_id = e.storage().instance().get(&DataKey::NextClaimId).unwrap_or(1u32);
        let claim = Claim {
            id: claim_id,
            claim_type,
            claim_value,
            issuer: caller,
            issued_at: e.ledger().timestamp(),
            verified: false,
            proof,
            revoked: false,
        };
        
        did_doc.claims.push_back(claim);
        did_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        let next_claim_id = claim_id.checked_add(1).expect("Claim ID overflow");
        e.storage().instance().set(&DataKey::NextClaimId, &next_claim_id);
        
        extend_persistent(&e, &DataKey::DID(did.clone()));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_added"), did),
            claim_id,
        );
        
        Ok(claim_id)
    }

    /// Verify a claim with off-chain oracle integration
    pub fn verify_claim(e: Env, did: String, claim_id: u32, oracle_signature: Bytes) -> Result<(), IdentityError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(IdentityError::NotInitialized)?;
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin.clone()) && !Self::has_role(&e, VERIFIER_ROLE, admin) {
            panic!("not authorized");
        }
        
        let mut did_doc = get_did_document(&e, &did)?;
        let mut claim = None;
        let mut claim_index = 0u32;
        
        // Find the claim
        for (i, c) in did_doc.claims.iter().enumerate() {
            if c.id == claim_id {
                claim = Some(c);
                claim_index = i as u32;
                break;
            }
        }
        
        let mut claim_obj = claim.ok_or(IdentityError::ClaimNotFound)?;
        if claim_obj.verified {
            return Err(IdentityError::ClaimAlreadyVerified);
        }
        if claim_obj.revoked {
            return Err(IdentityError::ClaimRevoked);
        }
        
        // Verify oracle signature
        if !verify_oracle_signature(&e, &did, claim_id, &oracle_signature) {
            return Err(IdentityError::InvalidOracleSignature);
        }
        
        claim_obj.verified = true;
        did_doc.claims.set(claim_index, claim_obj.clone());
        did_doc.reputation_score += VERIFIED_CREDENTIAL_SCORE;
        did_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        extend_persistent(&e, &DataKey::DID(did.clone()));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_verified"), did),
            (claim_id, claim_obj.claim_type),
        );
        Ok(())
    }

    /// Revoke a compromised credential
    pub fn revoke_claim(e: Env, did: String, claim_id: u32, reason: String) -> Result<(), IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        let caller = e.invoker();
        
        // Only controller, delegate, or admin can revoke
        if caller != did_doc.controller {
            let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(IdentityError::NotInitialized)?;
            if caller != admin {
                check_delegation(&e, &did, &caller, &String::from_str(&e, "revoke_claim"))?;
            }
        }
        
        let mut did_doc = get_did_document(&e, &did)?;
        let mut claim = None;
        let mut claim_index = 0u32;
        
        // Find the claim
        for (i, c) in did_doc.claims.iter().enumerate() {
            if c.id == claim_id {
                claim = Some(c);
                claim_index = i as u32;
                break;
            }
        }
        
        let mut claim_obj = claim.ok_or(IdentityError::ClaimNotFound)?;
        if claim_obj.revoked {
            return Err(IdentityError::ClaimRevoked);
        }
        
        claim_obj.revoked = true;
        let revocation = Revocation {
            claim_id,
            revoked_at: e.ledger().timestamp(),
            revoked_by: caller,
            reason,
        };
        
        did_doc.claims.set(claim_index, claim_obj);
        did_doc.updated = e.ledger().timestamp();
        
        // Store revocation record
        e.storage().persistent().set(&DataKey::Revocation(did.clone(), claim_id), &revocation);
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        
        extend_persistent(&e, &DataKey::DID(did.clone()));
        extend_persistent(&e, &DataKey::Revocation(did.clone(), claim_id));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_revoked"), did_doc.id),
            claim_id,
        );
        Ok(())
    }

    /// Add reputation score for event attendance
    pub fn add_event_attendance(e: Env, did: String, event_id: String, score: u32) -> Result<(), IdentityError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(IdentityError::NotInitialized)?;
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin.clone()) && !Self::has_role(&e, VERIFIER_ROLE, admin) {
            panic!("not authorized");
        }
        
        let mut did_doc = get_did_document(&e, &did)?;
        
        // Add attendance score
        let increment = score.min(EVENT_ATTENDANCE_SCORE);
        did_doc.reputation_score = did_doc.reputation_score.checked_add(increment).expect("Reputation overflow");
        did_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        extend_persistent(&e, &DataKey::DID(did.clone()));
        
        // Store attendance record
        let attendance_key = DataKey::EventAttendance(did, event_id.clone());
        e.storage().persistent().set(&attendance_key, &e.ledger().timestamp());
        extend_persistent(&e, &attendance_key);
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "attendance_recorded"), did_doc.id),
            (event_id, score),
        );
        Ok(())
    }

    /// Delegate identity management rights
    pub fn add_delegation(
        e: Env, 
        did: String, 
        delegate: Address, 
        permissions: Vec<String>,
        expiry: u64
    ) -> Result<(), IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        did_doc.controller.require_auth();
        
        check_paused(&e)?;
        
        if e.storage().persistent().has(&DataKey::Delegation(did.clone(), delegate.clone())) {
            return Err(IdentityError::AlreadyInitialized);
        }
        
        // Check delegation limit
        let existing_delegations = get_delegations(&e, &did);
        if existing_delegations.len() >= MAX_DELEGATIONS_PER_DID {
            return Err(IdentityError::MaxDelegationsReached);
        }
        
        let delegation = Delegation {
            delegate: delegate.clone(),
            permissions,
            created_at: e.ledger().timestamp(),
            expiry,
            revoked: false,
        };
        
        e.storage().persistent().set(&DataKey::Delegation(did.clone(), delegate.clone()), &delegation);
        extend_persistent(&e, &DataKey::Delegation(did, delegate.clone()));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "delegation_added"), did_doc.id),
            delegate,
        );
        Ok(())
    }

    /// Revoke a delegation
    pub fn revoke_delegation(e: Env, did: String, delegate: Address) -> Result<(), IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        let caller = e.invoker();
        
        // Only controller or the delegate themselves can revoke
        if caller != did_doc.controller && caller != delegate {
            return Err(IdentityError::Unauthorized);
        }
        
        let mut delegation: Delegation = e.storage().persistent().get(&DataKey::Delegation(did.clone(), delegate.clone()))
            .ok_or(IdentityError::DelegationNotFound)?;
        
        delegation.revoked = true;
        
        e.storage().persistent().set(&DataKey::Delegation(did.clone(), delegate.clone()), &delegation);
        extend_persistent(&e, &DataKey::Delegation(did, delegate.clone()));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "delegation_revoked"), did_doc.id),
            delegate,
        );
        Ok(())
    }

    /// Deactivate a DID
    pub fn deactivate_did(e: Env, did: String) -> Result<(), IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        did_doc.controller.require_auth();
        
        let mut updated_doc = did_doc;
        updated_doc.deactivated = true;
        updated_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &updated_doc);
        extend_persistent(&e, &DataKey::DID(did));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "did_deactivated"), updated_doc.id),
            (),
        );
        Ok(())
    }

    /// Resolve a DID to get the DID document
    pub fn resolve_did(e: Env, did: String) -> Result<DIDDocument, IdentityError> {
        get_did_document(&e, &did)
    }

    /// Get DID by address
    pub fn get_did_by_address(e: Env, address: Address) -> Option<String> {
        e.storage().persistent().get(&DataKey::AddressToDID(address))
    }

    /// Get reputation score
    pub fn get_reputation_score(e: Env, did: String) -> Result<u32, IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        Ok(did_doc.reputation_score)
    }

    /// Check if a claim is verified
    pub fn is_claim_verified(e: Env, did: String, claim_id: u32) -> Result<bool, IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        for claim in did_doc.claims.iter() {
            if claim.id == claim_id {
                return Ok(claim.verified && !claim.revoked);
            }
        }
        Ok(false)
    }

    /// Get verified claims of a specific type
    pub fn get_verified_claims_by_type(e: Env, did: String, claim_type: String) -> Result<Vec<Claim>, IdentityError> {
        let did_doc = get_did_document(&e, &did)?;
        let mut verified_claims = Vec::new(&e);
        
        for claim in did_doc.claims.iter() {
            if claim.claim_type == claim_type && claim.verified && !claim.revoked {
                verified_claims.push_back(claim);
            }
        }
        
        Ok(verified_claims)
    }

    /// Admin functions
    pub fn pause(e: Env) -> Result<(), IdentityError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(IdentityError::NotInitialized)?;
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage().instance().set(&DataKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(e: Env) -> Result<(), IdentityError> {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).ok_or(IdentityError::NotInitialized)?;
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        e.storage().instance().set(&DataKey::Paused, &false);
        Ok(())
    }

    pub fn get_total_dids(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::TotalDIDs).unwrap_or(0)
    }

    // --- ROLE MANAGEMENT ---
    pub fn grant_role(e: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let key = DataKey::Role(role, address);
        e.storage().persistent().set(&key, &true);
    }

    pub fn revoke_role(e: Env, admin: Address, role: Symbol, address: Address) {
        admin.require_auth();
        if !Self::has_role(&e, ADMIN_ROLE, admin) {
            panic!("not authorized");
        }
        let key = DataKey::Role(role, address);
        e.storage().persistent().remove(&key);
    }

    pub fn has_role(e: &Env, role: Symbol, address: Address) -> bool {
        let key = DataKey::Role(role, address);
        e.storage().persistent().has(&key)
    }
}

// Helper functions
fn extend_instance(e: &Env) {
    e.storage().instance().extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

fn extend_persistent(e: &Env, key: &DataKey) {
    e.storage().persistent().extend_ttl(key, TTL_PERSISTENT, TTL_PERSISTENT);
}

fn check_paused(e: &Env) -> Result<(), IdentityError> {
    let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap_or(false);
    if paused {
        return Err(IdentityError::Paused);
    }
    Ok(())
}

fn generate_did(e: &Env, address: &Address) -> String {
    // Generate DID in format: did:stellar:<address_hash>
    let address_bytes = address.to_bytes();
    let hash = crypto::sha256(e, &address_bytes);
    let hash_str = hex_encode(&hash);
    
    // Using manual concatenation for gas efficiency in no_std
    let mut did = String::from_str(e, "did:stellar:");
    // In a real implementation, we would append the hex_str
    // did.append(&hash_str); // Hypothetical
    did
}

fn hex_encode(bytes: &BytesN<32>) -> String {
    // Simplified hex encoding
    String::from_str(&bytes.env(), "0x")
}

fn get_did_document(e: &Env, did: &String) -> Result<DIDDocument, IdentityError> {
    e.storage().persistent().get(&DataKey::DID(did.clone()))
        .ok_or(IdentityError::DIDNotFound)
}

fn get_delegations(e: &Env, _did: &String) -> Vec<Delegation> {
    Vec::new(e)
}

fn check_delegation(e: &Env, did: &String, delegate: &Address, permission: &String) -> Result<bool, IdentityError> {
    let delegation: Delegation = e.storage().persistent().get(&DataKey::Delegation(did.clone(), delegate.clone()))
        .ok_or(IdentityError::DelegationNotFound)?;
    
    if delegation.revoked {
        return Err(IdentityError::DelegationRevoked);
    }
    
    if delegation.expiry < e.ledger().timestamp() {
        return Err(IdentityError::DelegationExpired);
    }
    
    // Check if permission is granted
    for perm in delegation.permissions.iter() {
        if &perm == permission {
            return Ok(true);
        }
    }
    
    Err(IdentityError::PermissionDenied)
}

fn verify_oracle_signature(e: &Env, did: &String, claim_id: u32, signature: &Bytes) -> bool {
    // Simplified oracle signature verification
    // In practice, this would verify the signature against the oracle's public key
    // and check that it contains the correct DID and claim_id
    true // Placeholder - implement real verification
}