//! Common data types and structures used across Gathera contracts

use soroban_sdk::{Address, Symbol, String, Vec, Map};

/// Common event types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EventType {
    Conference,
    Workshop,
    Meetup,
    Webinar,
    Concert,
    Sports,
    Other(Symbol),
}

/// Common status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum CommonStatus {
    Inactive = 0,
    Active = 1,
    Suspended = 2,
    Completed = 3,
    Cancelled = 4,
}

/// Common audit log entry
#[derive(Debug, Clone)]
pub struct AuditLog {
    pub timestamp: u64,
    pub actor: Address,
    pub action: Symbol,
    pub details: String,
}

/// Common pagination structure
#[derive(Debug, Clone)]
pub struct Pagination {
    pub offset: u32,
    pub limit: u32,
    pub total: u32,
}

/// Common query parameters
#[derive(Debug, Clone)]
pub struct QueryParams {
    pub pagination: Option<Pagination>,
    pub filters: Map<Symbol, String>,
    pub sort_by: Option<Symbol>,
    pub sort_direction: Option<SortDirection>,
}

/// Sort direction enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum SortDirection {
    Ascending = 0,
    Descending = 1,
}

/// Common metadata structure
#[derive(Debug, Clone)]
pub struct Metadata {
    pub version: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub tags: Vec<Symbol>,
}

/// Common result type for contract operations
pub type ContractResult<T> = Result<T, CommonError>;

/// Common error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CommonError {
    InvalidInput,
    Unauthorized,
    NotFound,
    AlreadyExists,
    InternalError,
    RateLimited,
    Maintenance,
}
