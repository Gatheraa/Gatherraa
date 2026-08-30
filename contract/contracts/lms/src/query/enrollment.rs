use soroban_sdk::{Address, Env};

/// Read-only enrollment queries (#656).
pub struct EnrollmentQueries;

impl EnrollmentQueries {
    /// Whether the given student is enrolled in the given course.
    ///
    /// Returns `false` today: enrollment storage does not exist on-chain
    /// yet, and enrollment is tracked in #645/#646. When that module lands
    /// it will read `StorageKey::Enrollment(student, course_id)` and this
    /// function returns whether a record actually exists.
    pub fn get_enrollment(env: &Env, student: &Address, course_id: u32) -> bool {
        let _ = (env, student, course_id);
        false
    }
}
