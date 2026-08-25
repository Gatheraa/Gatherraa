use soroban_sdk::contracterror;

/// Errors produced by the LMS progress module.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProgressError {
    /// No course is registered under the given identifier.
    CourseNotFound = 1,

    /// A course is already registered under the given identifier.
    CourseAlreadyExists = 2,

    /// The lesson index falls outside the course's lesson range.
    LessonOutOfRange = 3,

    /// The lesson has already been recorded as completed for this student.
    LessonAlreadyCompleted = 4,

    /// Only enrolled students can update progress.
    NotEnrolled = 5,
}
