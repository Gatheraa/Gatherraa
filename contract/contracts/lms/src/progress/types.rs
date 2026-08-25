pub use crate::course::Course;

use soroban_sdk::{contracttype, Address};

/// Number of basis points representing full completion.
pub const COMPLETE_BASIS_POINTS: u32 = 10_000;

/// Progress record for tracking a student's completion of an individual lesson.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Progress {
    pub student: Address,
    pub course_id: u32,
    pub lesson_id: u32,
    pub completed: bool,
    pub completed_at: u64,
}

/// Alias for Progress record.
pub type LessonProgress = Progress;

/// A student's progress through a single course.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CourseProgress {
    /// Number of distinct lessons the student has completed.
    pub completed_lessons: u32,

    /// Total number of lessons in the course.
    pub total_lessons: u32,

    /// Completion in basis points, from 0 to 10_000 inclusive.
    pub basis_points: u32,
}

impl CourseProgress {
    /// Whether the student has completed every lesson in the course.
    pub fn is_complete(&self) -> bool {
        self.total_lessons > 0 && self.completed_lessons == self.total_lessons
    }
}
