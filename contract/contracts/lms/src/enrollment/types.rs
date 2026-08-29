use soroban_sdk::{contracttype, Address};

/// Lifecycle state of an LMS enrollment.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EnrollmentStatus {
    /// The student is currently enrolled in the course.
    Active,
    /// The student has withdrawn from the course.
    ///
    /// The record is retained so withdrawal history stays queryable, but
    /// `is_enrolled` answers false and enrolling again is rejected while
    /// the record exists.
    Unenrolled,
}

/// Enrollment record persisted by the LMS contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Enrollment {
    /// The enrolled student's address.
    pub student: Address,
    /// The course the student enrolled in.
    pub course_id: u32,
    /// Ledger timestamp of the enrollment.
    pub enrolled_at: u64,
    /// Current enrollment state.
    pub status: EnrollmentStatus,
}
