//! Authentication traits for Gatheraa contracts
//! 
//! This module defines common authentication interfaces that can be implemented
//! across different contract types to ensure consistent authentication patterns.

use soroban_sdk::{Address, Env};

/// Trait for authentication and authorization
pub trait Auth {
    /// Check if an address has admin privileges
    fn is_admin(&self, env: &Env, address: &Address) -> bool;
    
    /// Check if an address has a specific role
    fn has_role(&self, env: &Env, address: &Address, role: &Symbol) -> bool;
    
    /// Validate that an address is authorized for an operation
    fn require_auth(&self, env: &Env, address: &Address, required_role: &Symbol) -> Result<(), crate::error::Error>;
}

/// Trait for role management
pub trait RoleManager {
    /// Grant a role to an address
    fn grant_role(&self, env: &Env, address: &Address, role: &Symbol);
    
    /// Revoke a role from an address
    fn revoke_role(&self, env: &Env, address: &Address, role: &Symbol);
    
    /// Check all roles for an address
    fn get_roles(&self, env: &Env, address: &Address) -> Vec<Symbol>;
}
