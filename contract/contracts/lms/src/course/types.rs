use soroban_sdk::contracttype;

/// The states a course moves through during its lifetime.
///
/// A course starts as a [`CourseStatus::Draft`] while its content is being
/// authored, becomes [`CourseStatus::Published`] when it opens to students,
/// and ends as [`CourseStatus::Archived`] when it is withdrawn. The
/// transitions between them are one-way and strictly ordered; see
/// [`crate::course::CourseLifecycle`] for what enforces that ordering.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CourseStatus {
    /// Being authored. Visible to staff, not yet open to students.
    Draft,

    /// Live. Students can enroll and make progress.
    Published,

    /// Withdrawn. Read-only: no further updates or re-publication.
    Archived,
}
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
