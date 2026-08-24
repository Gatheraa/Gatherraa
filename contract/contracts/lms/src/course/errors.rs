use soroban_sdk::contracterror;

/// Errors produced by the LMS course-lifecycle module.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum CourseError {
    /// No course is registered under the requested identifier.
    CourseNotFound = 1,

    /// The caller is not an instructor or an administrator.
    ///
    /// Every lifecycle operation is staff-only, so a student or an
    /// unregistered address can never modify a course, whatever state it
    /// is in.
    NotAuthorized = 2,

    /// The operation is not legal from the course's current state.
    ///
    /// The lifecycle runs strictly `Draft → Published → Archived`: a draft
    /// cannot be archived before it has ever been published, a published
    /// course cannot be published again, and an archived course can be
    /// neither updated nor re-published.
    InvalidTransition = 3,
}
