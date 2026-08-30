use soroban_sdk::Env;

use crate::StorageKey;

use super::types::Course;

/// Returns whether a course is registered under the given identifier.
pub fn has_course(env: &Env, course_id: u32) -> bool {
    env.storage()
        .persistent()
        .has(&StorageKey::Course(course_id))
}

/// Returns the course registered under the given identifier.
pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
    env.storage()
        .persistent()
        .get(&StorageKey::Course(course_id))
}

/// Persists a course record using its identifier as the unique key.
pub fn set_course(env: &Env, course: &Course) {
    env.storage()
        .persistent()
        .set(&StorageKey::Course(course.course_id), course);
}
