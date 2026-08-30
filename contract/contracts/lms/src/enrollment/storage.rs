use soroban_sdk::{Address, Env};

use crate::StorageKey;

use super::types::Enrollment;

/// Returns whether an enrollment record exists for the student and course.
pub fn has_enrollment(env: &Env, student: &Address, course_id: u32) -> bool {
    env.storage()
        .persistent()
        .has(&StorageKey::Enrollment(student.clone(), course_id))
}

/// Returns the enrollment record for the student and course, if any.
pub fn get_enrollment(env: &Env, student: &Address, course_id: u32) -> Option<Enrollment> {
    env.storage()
        .persistent()
        .get(&StorageKey::Enrollment(student.clone(), course_id))
}

/// Persists an enrollment record keyed by student and course.
pub fn set_enrollment(env: &Env, enrollment: &Enrollment) {
    env.storage().persistent().set(
        &StorageKey::Enrollment(enrollment.student.clone(), enrollment.course_id),
        enrollment,
    );
}
