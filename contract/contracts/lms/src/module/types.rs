use soroban_sdk::{contracttype, String};

/// Metadata persisted for a learning module.
///
/// Modules organize the lessons of a course into ordered sections. A module
/// always belongs to exactly one course, identified by `course_id`, and its
/// `position` within that course is what gives the curriculum its order.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Module {
    pub module_id: u32,
    pub course_id: u32,
    pub title: String,
    pub description_uri: String,
    pub position: u32,
    pub created_at: u64,
    pub updated_at: u64,
}
