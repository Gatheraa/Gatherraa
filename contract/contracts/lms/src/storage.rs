use soroban_sdk::{contracttype, Address};

/// Storage keys used by the LMS contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    /// Reserved for future LMS configuration.
    Configuration,

    /// Access-control record for a registered LMS user.
    User(Address),

    /// A registered course, keyed by course identifier.
    Course(u32),

    /// Cached count of lessons a student has completed in a course.
    StudentProgress(Address, u32),

    /// Whether a student has completed one specific lesson.
    LessonCompletion(Address, u32, u32),

    /// Persistent progress record for a student on a specific lesson.
    LessonProgress(Address, u32, u32),
}
