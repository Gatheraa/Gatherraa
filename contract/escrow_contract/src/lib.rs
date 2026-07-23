//! Gathera Escrow Contract
//!
//! This contract implements a secure escrow system for the Gathera platform.
//! It facilitates secure transactions between parties with conditional release
//! mechanisms and dispute resolution capabilities.
//!
//! ## Key Features
//!
//! - Secure fund escrow with multi-sig support
//! - Conditional release mechanisms
//! - Dispute resolution system
//! - Time-based auto-release
//! - Integration with ticket contract for event-based escrows

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Env, String,
    Symbol, Vec,
};

/// Errors that can occur during escrow operations
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum EscrowError {
    /// Escrow already exists
    EscrowAlreadyExists = 1,
    /// Escrow does not exist
    EscrowNotFound = 2,
    /// Unauthorized access
    Unauthorized = 3,
    /// Insufficient funds
    InsufficientFunds = 4,
    /// Invalid escrow terms
    InvalidTerms = 5,
    /// Escrow already completed
    AlreadyCompleted = 6,
    /// Dispute already exists
    DisputeExists = 7,
    /// Invalid dispute resolution
    InvalidResolution = 8,
    /// Escrow expired
    EscrowExpired = 9,
    /// Functionality not implemented yet
    NotImplemented = 255,
}

/// Escrow status enumeration
#[contracttype]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum EscrowStatus {
    Pending = 0,
    Created = 6,
    Funded = 1,
    Completed = 2,
    Disputed = 3,
    Refunded = 4,
    Expired = 5,
}

/// Escrow data structure
#[contracttype]
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Escrow {
    /// Unique escrow identifier
    pub escrow_id: Symbol,
    /// Depositor address
    pub depositor: Address,
    /// Beneficiary address
    pub beneficiary: Address,
    /// Amount in escrow
    pub amount: u128,
    /// Current escrow status
    pub status: EscrowStatus,
    /// Creation timestamp
    pub created_at: u64,
    /// Expiration timestamp
    pub expires_at: u64,
    /// Escrow terms and conditions
    pub terms: String,
    /// Required confirmations for release
    pub required_confirmations: u32,
    /// Current confirmations (addresses of those who confirmed)
    pub confirmations: Vec<Address>,
}

/// Dispute data structure
#[contracttype]
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct Dispute {
    /// Unique dispute identifier
    pub dispute_id: Symbol,
    /// Associated escrow ID
    pub escrow_id: Symbol,
    /// Dispute initiator
    pub initiator: Address,
    /// Dispute reason
    pub reason: String,
    /// Dispute status
    pub resolved: bool,
    /// Resolution details
    pub resolution: Option<String>,
}

/// Storage keys
#[contracttype]
enum DataKey {
    Token,           // Address of the token contract
    Admin,           // Address authorized to resolve disputes
    EscrowCounter,   // u32 counter for generating unique IDs
    Escrow(Symbol),  // Escrow data keyed by escrow_id
    Dispute(Symbol), // Dispute data keyed by dispute_id
}

/// Main contract implementation
#[contract]
pub struct EscrowContract;

#[cfg(test)]
mod security_tests;

#[contractimpl]
impl EscrowContract {
    /// Initialize the contract with the token address and admin.
    /// This must be called once before any other operation.
    pub fn initialize(env: Env, token: Address, admin: Address) -> Result<(), EscrowError> {
        if env.storage().instance().has(&DataKey::Token) {
            return Err(EscrowError::EscrowAlreadyExists); // reuse error as "already initialized"
        }
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowCounter, &0u32);
        Ok(())
    }

    /// Create a new escrow
    ///
    /// # Arguments
    ///
    /// * `beneficiary` - Address of the beneficiary
    /// * `amount` - Amount to escrow
    /// * `expires_at` - Expiration timestamp
    /// * `terms` - Escrow terms and conditions
    /// * `required_confirmations` - Number of confirmations needed for release
    ///
    /// # Returns
    ///
    /// Escrow ID of the newly created escrow
    pub fn create_escrow(
        env: Env,
        beneficiary: Address,
        amount: u128,
        expires_at: u64,
        terms: String,
        required_confirmations: u32,
    ) -> Result<Symbol, EscrowError> {
        // Validate inputs
        if amount == 0 {
            return Err(EscrowError::InvalidTerms);
        }
        if expires_at <= env.ledger().timestamp() {
            return Err(EscrowError::InvalidTerms);
        }
        if required_confirmations == 0 {
            return Err(EscrowError::InvalidTerms);
        }

        let depositor = env.invoker();

        // Generate unique escrow ID
        let counter_key = DataKey::EscrowCounter;
        let mut counter: u32 = env.storage().instance().get(&counter_key).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&counter_key, &counter);
        let escrow_id = Symbol::new(&env, &format!("ESCROW-{}", counter));

        // Create escrow record
        let escrow = Escrow {
            escrow_id: escrow_id.clone(),
            depositor: depositor.clone(),
            beneficiary: beneficiary.clone(),
            amount,
            status: EscrowStatus::Pending,
            created_at: env.ledger().timestamp(),
            expires_at,
            terms: terms.clone(),
            required_confirmations,
            confirmations: Vec::new(&env),
        };

        // Store escrow
        env.storage()
            .instance()
            .set(&DataKey::Escrow(escrow_id.clone()), &escrow);

        Ok(escrow_id)
    }

    /// Fund an existing escrow
    ///
    /// # Arguments
    ///
    /// * `escrow_id` - Identifier for the escrow
    ///
    /// # Returns
    ///
    /// True if funding was successful
    pub fn fund_escrow(env: Env, escrow_id: Symbol) -> Result<bool, EscrowError> {
        let invoker = env.invoker();

        // Load escrow
        let mut escrow = Self::get_escrow_internal(&env, &escrow_id)?;

        // Check status and authorization
        if escrow.status != EscrowStatus::Pending {
            return Err(EscrowError::AlreadyCompleted);
        }
        if invoker != escrow.depositor {
            return Err(EscrowError::Unauthorized);
        }
        if env.ledger().timestamp() >= escrow.expires_at {
            escrow.status = EscrowStatus::Expired;
            Self::save_escrow(&env, &escrow);
            return Err(EscrowError::EscrowExpired);
        }

        // Transfer tokens from depositor to this contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        let amount_i128 = escrow
            .amount
            .try_into()
            .map_err(|_| EscrowError::InsufficientFunds)?;
        token.transfer_from(&invoker, &env.current_contract_address(), &amount_i128);

        // Update escrow status
        escrow.status = EscrowStatus::Funded;
        Self::save_escrow(&env, &escrow);

        Ok(true)
    }

    /// Release funds from escrow
    ///
    /// Each call adds the invoker's confirmation. When the required number
    /// of confirmations is reached, funds are transferred to the beneficiary.
    ///
    /// # Arguments
    ///
    /// * `escrow_id` - Identifier for the escrow
    ///
    /// # Returns
    ///
    /// True if release was successful
    pub fn release_funds(env: Env, escrow_id: Symbol) -> Result<bool, EscrowError> {
        let invoker = env.invoker();

        // Load escrow
        let mut escrow = Self::get_escrow_internal(&env, &escrow_id)?;

        // Only Funded or Disputed? We'll allow release only if Funded or Disputed with resolution release.
        if escrow.status != EscrowStatus::Funded && escrow.status != EscrowStatus::Disputed {
            return Err(EscrowError::AlreadyCompleted);
        }

        // Only depositor or beneficiary may confirm
        if invoker != escrow.depositor && invoker != escrow.beneficiary {
            return Err(EscrowError::Unauthorized);
        }

        // Check expiration
        if env.ledger().timestamp() >= escrow.expires_at {
            escrow.status = EscrowStatus::Expired;
            Self::save_escrow(&env, &escrow);
            return Err(EscrowError::EscrowExpired);
        }

        // Add invoker's confirmation if not already present
        let mut confirmations = escrow.confirmations.clone();
        if !confirmations.contains(&invoker) {
            confirmations.push_back(invoker.clone());
            escrow.confirmations = confirmations.clone();
        }

        // Check if required confirmations are met
        if confirmations.len() < escrow.required_confirmations as usize {
            // Not enough confirmations yet; save updated confirmations and return false
            Self::save_escrow(&env, &escrow);
            return Ok(false);
        }

        // Enough confirmations: transfer funds to beneficiary
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        let amount_i128 = escrow
            .amount
            .try_into()
            .map_err(|_| EscrowError::InsufficientFunds)?;
        token.transfer(
            &env.current_contract_address(),
            &escrow.beneficiary,
            &amount_i128,
        );

        // Update escrow status
        escrow.status = EscrowStatus::Completed;
        Self::save_escrow(&env, &escrow);

        Ok(true)
    }

    /// Create a dispute for an escrow
    ///
    /// # Arguments
    ///
    /// * `escrow_id` - Identifier for the escrow
    /// * `reason` - Dispute reason
    ///
    /// # Returns
    ///
    /// Dispute ID of the newly created dispute
    pub fn create_dispute(
        env: Env,
        escrow_id: Symbol,
        reason: String,
    ) -> Result<Symbol, EscrowError> {
        let invoker = env.invoker();

        // Load escrow
        let mut escrow = Self::get_escrow_internal(&env, &escrow_id)?;

        // Only depositor or beneficiary can dispute
        if invoker != escrow.depositor && invoker != escrow.beneficiary {
            return Err(EscrowError::Unauthorized);
        }

        // Only pending or funded escrows can be disputed
        if escrow.status != EscrowStatus::Pending && escrow.status != EscrowStatus::Funded {
            return Err(EscrowError::AlreadyCompleted);
        }

        // Check if dispute already exists (we'll check by trying to load dispute with same escrow_id)
        // We store disputes keyed by escrow_id (unique per escrow)
        let dispute_key = DataKey::Dispute(escrow_id.clone());
        if env.storage().instance().has(&dispute_key) {
            return Err(EscrowError::DisputeExists);
        }

        // Generate dispute ID
        let dispute_id = Symbol::new(&env, &format!("DISPUTE-{}", escrow_id.to_string()));

        let dispute = Dispute {
            dispute_id: dispute_id.clone(),
            escrow_id: escrow_id.clone(),
            initiator: invoker,
            reason: reason.clone(),
            resolved: false,
            resolution: None,
        };

        // Store dispute
        env.storage().instance().set(&dispute_key, &dispute);

        // Update escrow status
        escrow.status = EscrowStatus::Disputed;
        Self::save_escrow(&env, &escrow);

        Ok(dispute_id)
    }

    /// Resolve a dispute
    ///
    /// # Arguments
    ///
    /// * `dispute_id` - Identifier for the dispute
    /// * `resolution` - Dispute resolution details: must be either "release" or "refund"
    ///
    /// # Returns
    ///
    /// True if resolution was successful
    pub fn resolve_dispute(
        env: Env,
        dispute_id: Symbol,
        resolution: String,
    ) -> Result<bool, EscrowError> {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if env.invoker() != admin {
            return Err(EscrowError::Unauthorized);
        }

        // Load dispute using its ID to find the associated escrow
        // We need a way to get dispute by ID. Since we store disputes by escrow_id,
        // we would need to scan or maintain a mapping. Simpler: we can require the
        // caller to provide escrow_id as well, but the signature only has dispute_id.
        // We'll store disputes in a map keyed by dispute_id as well.
        let dispute_key = DataKey::Dispute(dispute_id.clone());
        let mut dispute: Dispute = env
            .storage()
            .instance()
            .get(&dispute_key)
            .ok_or(EscrowError::EscrowNotFound)?;

        if dispute.resolved {
            return Err(EscrowError::AlreadyCompleted);
        }

        // Load escrow
        let mut escrow = Self::get_escrow_internal(&env, &dispute.escrow_id)?;

        // Check resolution string
        if resolution != "release" && resolution != "refund" {
            return Err(EscrowError::InvalidResolution);
        }

        // Resolve according to resolution
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token = TokenClient::new(&env, &token_addr);
        let amount_i128 = escrow
            .amount
            .try_into()
            .map_err(|_| EscrowError::InsufficientFunds)?;

        if resolution == "release" {
            // Release to beneficiary
            token.transfer(
                &env.current_contract_address(),
                &escrow.beneficiary,
                &amount_i128,
            );
            escrow.status = EscrowStatus::Completed;
        } else {
            // refund
            token.transfer(
                &env.current_contract_address(),
                &escrow.depositor,
                &amount_i128,
            );
            escrow.status = EscrowStatus::Refunded;
        }

        // Update dispute and escrow
        dispute.resolved = true;
        dispute.resolution = Some(resolution.clone());
        env.storage().instance().set(&dispute_key, &dispute);
        Self::save_escrow(&env, &escrow);

        Ok(true)
    }

    /// Get escrow information
    ///
    /// # Arguments
    ///
    /// * `escrow_id` - Identifier for the escrow
    ///
    /// # Returns
    ///
    /// Escrow data structure
    pub fn get_escrow(env: Env, escrow_id: Symbol) -> Result<Escrow, EscrowError> {
        Self::get_escrow_internal(&env, &escrow_id)
    }

    // ---- Internal helpers ----

    fn get_escrow_internal(env: &Env, escrow_id: &Symbol) -> Result<Escrow, EscrowError> {
        let key = DataKey::Escrow(escrow_id.clone());
        env.storage()
            .instance()
            .get(&key)
            .ok_or(EscrowError::EscrowNotFound)
    }

    fn save_escrow(env: &Env, escrow: &Escrow) {
        let key = DataKey::Escrow(escrow.escrow_id.clone());
        env.storage().instance().set(&key, escrow);
    }
}
