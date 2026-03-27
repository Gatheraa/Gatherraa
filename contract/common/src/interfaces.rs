//! Cross-module interfaces for Gatheraa contracts
//! 
//! This module defines interfaces that allow modules to interact without
//! creating circular dependencies by using trait abstractions.

use soroban_sdk::{Address, Env, Symbol, Vec};

/// Interface for identity verification across modules
pub trait IdentityProvider {
    /// Verify if an address has a valid identity
    fn verify_identity(&self, env: &Env, address: &Address) -> Result<bool, crate::error::Error>;
    
    /// Get identity attributes for an address
    fn get_identity_attributes(&self, env: &Env, address: &Address) -> Result<Vec<(Symbol, Vec<u8>)>, crate::error::Error>;
    
    /// Check if an address is whitelisted
    fn is_whitelisted(&self, env: &Env, address: &Address, list_id: &Symbol) -> bool;
}

/// Interface for payment processing across modules
pub trait PaymentProcessor {
    /// Process a payment from sender to receiver
    fn process_payment(&self, env: &Env, from: &Address, to: &Address, amount: i128, token: &Address) -> Result<(), crate::error::Error>;
    
    /// Check if an address has sufficient balance
    fn has_sufficient_balance(&self, env: &Env, address: &Address, amount: i128, token: &Address) -> bool;
    
    /// Get token balance for an address
    fn get_balance(&self, env: &Env, address: &Address, token: &Address) -> i128;
}

/// Interface for governance decisions across modules
pub trait GovernanceProvider {
    /// Check if a proposal is active
    fn is_proposal_active(&self, env: &Env, proposal_id: &Symbol) -> bool;
    
    /// Check if an address has voting power
    fn get_voting_power(&self, env: &Env, address: &Address) -> u64;
    
    /// Check if a feature is enabled
    fn is_feature_enabled(&self, env: &Env, feature_id: &Symbol) -> bool;
}

/// Interface for event management across modules
pub trait EventProvider {
    /// Check if an event exists
    fn event_exists(&self, env: &Env, event_id: &Symbol) -> bool;
    
    /// Get event details
    fn get_event_details(&self, env: &Env, event_id: &Symbol) -> Result<EventDetails, crate::error::Error>;
    
    /// Check if an address has event access
    fn has_event_access(&self, env: &Env, address: &Address, event_id: &Symbol) -> bool;
}

/// Event details structure
#[derive(Clone, Debug)]
pub struct EventDetails {
    pub id: Symbol,
    pub organizer: Address,
    pub timestamp: u64,
    pub capacity: u32,
    pub is_active: bool,
}

/// Registry for cross-module interfaces
pub struct InterfaceRegistry {
    identity_provider: Option<Address>,
    payment_processor: Option<Address>,
    governance_provider: Option<Address>,
    event_provider: Option<Address>,
}

impl InterfaceRegistry {
    pub fn new() -> Self {
        Self {
            identity_provider: None,
            payment_processor: None,
            governance_provider: None,
            event_provider: None,
        }
    }
    
    pub fn register_identity_provider(&mut self, address: &Address) {
        self.identity_provider = Some(address.clone());
    }
    
    pub fn register_payment_processor(&mut self, address: &Address) {
        self.payment_processor = Some(address.clone());
    }
    
    pub fn register_governance_provider(&mut self, address: &Address) {
        self.governance_provider = Some(address.clone());
    }
    
    pub fn register_event_provider(&mut self, address: &Address) {
        self.event_provider = Some(address.clone());
    }
    
    pub fn get_identity_provider(&self) -> Option<&Address> {
        self.identity_provider.as_ref()
    }
    
    pub fn get_payment_processor(&self) -> Option<&Address> {
        self.payment_processor.as_ref()
    }
    
    pub fn get_governance_provider(&self) -> Option<&Address> {
        self.governance_provider.as_ref()
    }
    
    pub fn get_event_provider(&self) -> Option<&Address> {
        self.event_provider.as_ref()
    }
}
