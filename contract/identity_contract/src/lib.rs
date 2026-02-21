#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{DataKey, DIDDocument, Claim, Credential, Delegation, Revocation};

use soroban_sdk::{
    contract, contractimpl, vec, Address, Bytes, BytesN, Env, String, Symbol, Vec, crypto,
};

#[contract]
pub struct IdentityRegistryContract;

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
    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::TotalDIDs, &0u32);
        extend_instance(&e);
    }

    /// Create a new DID for a user
    pub fn create_did(e: Env, user: Address, public_key: BytesN<32>) -> String {
        user.require_auth();
        
        check_paused(&e);
        
        let did_string = generate_did(&e, &user);
        
        if e.storage().persistent().has(&DataKey::DID(did_string.clone())) {
            panic!("DID already exists for this address");
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
        let total_dids: u32 = e.storage().instance().get(&DataKey::TotalDIDs).unwrap();
        e.storage().instance().set(&DataKey::TotalDIDs, &(total_dids + 1));
        
        extend_persistent(&e, &DataKey::DID(did_string.clone()));
        extend_persistent(&e, &DataKey::AddressToDID(user));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "did_created"), user.clone()),
            did_string.clone(),
        );
        
        did_string
    }

    /// Add a claim to a DID (Twitter, GitHub, email, etc.)
    pub fn add_claim(
        e: Env, 
        did: String, 
        claim_type: String, 
        claim_value: String, 
        proof: Bytes
    ) -> u32 {
        let mut did_doc = get_did_document(&e, &did);
        let caller = e.invoker();
        
        // Only controller or delegate can add claims
        if caller != did_doc.controller {
            check_delegation(&e, &did, &caller, &String::from_str(&e, "add_claim"));
        }
        
        check_paused(&e);
        
        if did_doc.claims.len() >= MAX_CLAIMS_PER_DID {
            panic!("Maximum claims limit reached");
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
        e.storage().instance().set(&DataKey::NextClaimId, &(claim_id + 1));
        
        extend_persistent(&e, &DataKey::DID(did));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_added"), did.clone()),
            claim_id,
        );
        
        claim_id
    }

    /// Verify a claim with off-chain oracle integration
    pub fn verify_claim(e: Env, did: String, claim_id: u32, oracle_signature: Bytes) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        let mut did_doc = get_did_document(&e, &did);
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
        
        let mut claim_obj = claim.unwrap_or_else(|| panic!("Claim not found"));
        if claim_obj.verified {
            panic!("Claim already verified");
        }
        if claim_obj.revoked {
            panic!("Claim has been revoked");
        }
        
        // Verify oracle signature (simplified - in practice would verify against oracle public key)
        verify_oracle_signature(&e, &did, claim_id, &oracle_signature);
        
        claim_obj.verified = true;
        did_doc.claims.set(claim_index, claim_obj);
        did_doc.reputation_score += VERIFIED_CREDENTIAL_SCORE;
        did_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        extend_persistent(&e, &DataKey::DID(did));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_verified"), did.clone()),
            (claim_id, claim_obj.claim_type),
        );
    }

    /// Revoke a compromised credential
    pub fn revoke_claim(e: Env, did: String, claim_id: u32, reason: String) {
        let did_doc = get_did_document(&e, &did);
        let caller = e.invoker();
        
        // Only controller, delegate, or admin can revoke
        if caller != did_doc.controller {
            let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
            if caller != admin {
                check_delegation(&e, &did, &caller, &String::from_str(&e, "revoke_claim"));
            }
        }
        
        let mut did_doc = get_did_document(&e, &did);
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
        
        let mut claim_obj = claim.unwrap_or_else(|| panic!("Claim not found"));
        if claim_obj.revoked {
            panic!("Claim already revoked");
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
        extend_persistent(&e, &DataKey::Revocation(did, claim_id));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "claim_revoked"), did_doc.id),
            claim_id,
        );
    }

    /// Add reputation score for event attendance
    pub fn add_event_attendance(e: Env, did: String, event_id: String, score: u32) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        let mut did_doc = get_did_document(&e, &did);
        
        // Add attendance score
        did_doc.reputation_score += score.min(EVENT_ATTENDANCE_SCORE);
        did_doc.updated = e.ledger().timestamp();
        
        e.storage().persistent().set(&DataKey::DID(did.clone()), &did_doc);
        extend_persistent(&e, &DataKey::DID(did));
        
        // Store attendance record
        let attendance_key = DataKey::EventAttendance(did.clone(), event_id);
        e.storage().persistent().set(&attendance_key, &e.ledger().timestamp());
        extend_persistent(&e, &attendance_key);
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "attendance_recorded"), did_doc.id),
            (event_id, score),
        );
    }

    /// Delegate identity management rights
    pub fn add_delegation(
        e: Env, 
        did: String, 
        delegate: Address, 
        permissions: Vec<String>,
        expiry: u64
    ) {
        let did_doc = get_did_document(&e, &did);
        did_doc.controller.require_auth();
        
        check_paused(&e);
        
        if e.storage().persistent().has(&DataKey::Delegation(did.clone(), delegate.clone())) {
            panic!("Delegation already exists");
        }
        
        // Check delegation limit
        let existing_delegations = get_delegations(&e, &did);
        if existing_delegations.len() >= MAX_DELEGATIONS_PER_DID {
            panic!("Maximum delegations limit reached");
        }
        
        let delegation = Delegation {
            delegate: delegate.clone(),
            permissions,
            created_at: e.ledger().timestamp(),
            expiry,
            revoked: false,
        };
        
        e.storage().persistent().set(&DataKey::Delegation(did.clone(), delegate.clone()), &delegation);
        extend_persistent(&e, &DataKey::Delegation(did.clone(), delegate));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "delegation_added"), did_doc.id),
            delegate,
        );
    }

    /// Revoke a delegation
    pub fn revoke_delegation(e: Env, did: String, delegate: Address) {
        let did_doc = get_did_document(&e, &did);
        let caller = e.invoker();
        
        // Only controller or the delegate themselves can revoke
        if caller != did_doc.controller && caller != delegate {
            panic!("Unauthorized to revoke delegation");
        }
        
        if !e.storage().persistent().has(&DataKey::Delegation(did.clone(), delegate.clone())) {
            panic!("Delegation not found");
        }
        
        let mut delegation: Delegation = e.storage().persistent().get(&DataKey::Delegation(did.clone(), delegate.clone())).unwrap();
        delegation.revoked = true;
        
        e.storage().persistent().set(&DataKey::Delegation(did.clone(), delegate.clone()), &delegation);
        extend_persistent(&e, &DataKey::Delegation(did, delegate));
        
        // Emit event
        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "delegation_revoked"), did_doc.id),
            delegate,
        );
    }

    /// Deactivate a DID
    pub fn deactivate_did(e: Env, did: String) {
        let did_doc = get_did_document(&e, &did);
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
    }

    /// Resolve a DID to get the DID document
    pub fn resolve_did(e: Env, did: String) -> DIDDocument {
        get_did_document(&e, &did)
    }

    /// Get DID by address
    pub fn get_did_by_address(e: Env, address: Address) -> Option<String> {
        e.storage().persistent().get(&DataKey::AddressToDID(address))
    }

    /// Get reputation score
    pub fn get_reputation_score(e: Env, did: String) -> u32 {
        let did_doc = get_did_document(&e, &did);
        did_doc.reputation_score
    }

    /// Check if a claim is verified
    pub fn is_claim_verified(e: Env, did: String, claim_id: u32) -> bool {
        let did_doc = get_did_document(&e, &did);
        for claim in did_doc.claims.iter() {
            if claim.id == claim_id {
                return claim.verified && !claim.revoked;
            }
        }
        false
    }

    /// Get verified claims of a specific type
    pub fn get_verified_claims_by_type(e: Env, did: String, claim_type: String) -> Vec<Claim> {
        let did_doc = get_did_document(&e, &did);
        let mut verified_claims = Vec::new(&e);
        
        for claim in did_doc.claims.iter() {
            if claim.claim_type == claim_type && claim.verified && !claim.revoked {
                verified_claims.push_back(claim);
            }
        }
        
        verified_claims
    }

    /// Admin functions
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

    pub fn get_total_dids(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::TotalDIDs).unwrap_or(0)
    }
}

// Helper functions
fn extend_instance(e: &Env) {
    e.storage().instance().extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

fn extend_persistent(e: &Env, key: &DataKey) {
    e.storage().persistent().extend_ttl(key, TTL_PERSISTENT, TTL_PERSISTENT);
}

fn check_paused(e: &Env) {
    let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
    if paused {
        panic!("contract is paused");
    }
}

fn generate_did(e: &Env, address: &Address) -> String {
    // Generate DID in format: did:stellar:<address_hash>
    let address_bytes = address.to_bytes();
    let hash = crypto::sha256(e, &address_bytes);
    let hash_str = hex_encode(&hash);
    String::from_str(e, &format!("did:stellar:{}", hash_str))
}

fn hex_encode(bytes: &BytesN<32>) -> String {
    // Simplified hex encoding - in practice use proper hex encoding
    let mut result = String::from_str(&bytes.env(), "0x");
    // This is a placeholder - real implementation would convert bytes to hex string
    result
}

fn get_did_document(e: &Env, did: &String) -> DIDDocument {
    e.storage().persistent().get(&DataKey::DID(did.clone()))
        .unwrap_or_else(|| panic!("DID not found"))
}

fn get_delegations(e: &Env, did: &String) -> Vec<Delegation> {
    let mut delegations = Vec::new(&e.env());
    // In practice, you'd iterate through storage to find all delegations for a DID
    // This is a simplified approach
    delegations
}

fn check_delegation(e: &Env, did: &String, delegate: &Address, permission: &String) -> bool {
    if !e.storage().persistent().has(&DataKey::Delegation(did.clone(), delegate.clone())) {
        panic!("No delegation found");
    }
    
    let delegation: Delegation = e.storage().persistent().get(&DataKey::Delegation(did.clone(), delegate.clone())).unwrap();
    
    if delegation.revoked {
        panic!("Delegation has been revoked");
    }
    
    if delegation.expiry < e.ledger().timestamp() {
        panic!("Delegation has expired");
    }
    
    // Check if permission is granted
    for perm in delegation.permissions.iter() {
        if &perm == permission {
            return true;
        }
    }
    
    panic!("Permission not granted in delegation");
}

fn verify_oracle_signature(e: &Env, did: &String, claim_id: u32, signature: &Bytes) -> bool {
    // Simplified oracle signature verification
    // In practice, this would verify the signature against the oracle's public key
    // and check that it contains the correct DID and claim_id
    true // Placeholder - implement real verification
}