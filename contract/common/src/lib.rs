//! Gathera Common Library
//! 
//! This crate provides shared utilities, types, and functionality used across
//! all Gathera smart contracts. It serves as the foundation for the Gathera
//! ecosystem, ensuring consistency and reducing code duplication.
//! 
//! ## Modules
//! 
//! - `gas_testing`: Comprehensive gas measurement and testing utilities
//! - `types`: Shared data types and structures
//! - `errors`: Common error types and handling
//! - `utils`: General utility functions

pub mod gas_testing;
pub mod types;
pub mod errors;
pub mod utils;

// Re-export commonly used items
pub use gas_testing::*;
pub use types::*;
pub use errors::*;
pub use utils::*;
