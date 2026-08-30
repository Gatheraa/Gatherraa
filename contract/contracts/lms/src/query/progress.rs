use soroban_sdk::{Address, Env};

use crate::progress::{CourseProgress, Progress, ProgressError};

/// Read-only progress queries (#656).
pub struct ProgressQueries;

impl ProgressQueries {
    /// Calculate a student's progress through a course.
    ///
    /// Delegates to the progress module's existing calculation so there is
    /// exactly one source of truth for how progress is derived. Reads
    /// `StorageKey::StudentProgress` and `StorageKey::LessonCompletion`; a
    /// student with no record reads as zero progress, not as an error.
    ///
    /// # Errors
    /// * `ProgressError::CourseNotFound` — no course is registered under
    ///   `course_id`
    pub fn get_course_progress(
        env: &Env,
        student: &Address,
        course_id: u32,
    ) -> Result<CourseProgress, ProgressError> {
        Progress::get_course_progress(env, student, course_id)
    }
}
