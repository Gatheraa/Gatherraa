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
    ///
    /// Keyed by student address and course identifier. This is a
    /// denormalisation of the `LessonCompletion` flags below, maintained so
    /// that reading progress costs one storage entry instead of one per
    /// lesson. It is only ever incremented alongside setting a flag that
    /// was previously unset, which is what keeps the two in agreement.
    StudentProgress(Address, u32),

    /// Whether a student has completed one specific lesson.
    ///
    /// Keyed by student address, course identifier, and zero-based lesson
    /// index. Recording completions per lesson rather than as a bare
    /// counter is what makes completing the same lesson twice detectable.
    LessonCompletion(Address, u32, u32),

    /// A certificate issued by the LMS, keyed by certificate identifier.
    Certificate(u64),

    /// Monotonic counter allocating unique certificate identifiers.
    ///
    /// Lives in instance storage alongside `Configuration`: there is exactly
    /// one of it and it is the contract's own state, not a per-record
    /// record.
    CertificateCounter,
}
