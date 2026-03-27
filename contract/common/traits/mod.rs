//! Common traits for Gatheraa contracts
//! 
//! This module exports all trait definitions used across the Gatheraa platform
//! to ensure consistent interfaces and patterns.

pub mod auth;
pub mod storage;
pub mod validation;

// Re-export commonly used traits
pub use auth::{Auth, RoleManager};
pub use storage::{StorageKey, BatchStorage, StorageMigration, StorageOptimizer};
pub use validation::{Validator, BusinessValidator, TimeValidator};
