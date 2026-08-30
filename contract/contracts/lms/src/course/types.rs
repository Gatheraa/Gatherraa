use soroban_sdk::{contracttype, Address, String};

/// Lifecycle state of an LMS course.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CourseStatus {
    Draft,
    Published,
    Archived,
}

/// Course metadata persisted by the LMS contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Course {
    pub course_id: u32,
    pub instructor: Address,
    pub title: String,
    pub description_uri: String,
    pub price: i128,
    pub status: CourseStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub total_lessons: u32,
}
