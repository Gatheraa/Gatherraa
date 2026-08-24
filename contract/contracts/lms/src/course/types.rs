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
