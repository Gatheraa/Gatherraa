pub use crate::course::Course;

use soroban_sdk::contracttype;

/// Number of basis points representing full completion.
///
/// Progress is reported in basis points rather than whole percent so that
/// fractions like one lesson out of three survive the calculation with
/// useful precision (3333 rather than 33).
pub const COMPLETE_BASIS_POINTS: u32 = 10_000;

/// A student's progress through a single course.
///
/// The raw counts are returned alongside the derived percentage so callers
/// never have to trust the rounding. Anything that needs an exact answer —
/// certificate issuance, reward eligibility — should compare
/// `completed_lessons` against `total_lessons` directly rather than testing
/// `basis_points` against a threshold.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CourseProgress {
    /// Number of distinct lessons the student has completed.
    pub completed_lessons: u32,

    /// Total number of lessons in the course.
    pub total_lessons: u32,

    /// Completion in basis points, from 0 to 10_000 inclusive.
    ///
    /// Truncated toward zero, which means the value reaches
    /// `COMPLETE_BASIS_POINTS` only when every lesson is genuinely
    /// complete. A partially finished course can never round up to look
    /// finished.
    pub basis_points: u32,
}

impl CourseProgress {
    /// Whether the student has completed every lesson in the course.
    ///
    /// An empty course is never complete. There is nothing in it to
    /// complete, and treating it as finished would let a course with no
    /// content confer whatever completion unlocks.
    pub fn is_complete(&self) -> bool {
        self.total_lessons > 0 && self.completed_lessons == self.total_lessons
    }
}
