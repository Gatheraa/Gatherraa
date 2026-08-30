use soroban_sdk::{Address, Env};

use crate::course::Course;
use crate::StorageKey;

/// Returns whether a course is registered under the given identifier.
pub fn has_course(env: &Env, course_id: u32) -> bool {
    crate::course::storage::has_course(env, course_id)
}

/// Returns the course registered under the given identifier.
pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
    crate::course::storage::get_course(env, course_id)
}

/// Persist a course record.
pub fn set_course(env: &Env, course: &Course) {
    crate::course::storage::set_course(env, course)
}

/// Returns whether a student has completed one specific lesson.
pub fn is_lesson_completed(
    env: &Env,
    student: &Address,
    course_id: u32,
    lesson_index: u32,
) -> bool {
    env.storage()
        .persistent()
        .has(&StorageKey::LessonCompletion(
            student.clone(),
            course_id,
            lesson_index,
        ))
}

/// Record one lesson as completed for a student.
pub fn set_lesson_completed(env: &Env, student: &Address, course_id: u32, lesson_index: u32) {
    env.storage().persistent().set(
        &StorageKey::LessonCompletion(student.clone(), course_id, lesson_index),
        &true,
    );
}

/// Returns how many lessons a student has completed in a course.
///
/// A student who has never touched the course has completed none of it, so
/// a missing entry reads as zero rather than as an error.
pub fn get_completed_count(env: &Env, student: &Address, course_id: u32) -> u32 {
    env.storage()
        .persistent()
        .get(&StorageKey::StudentProgress(student.clone(), course_id))
        .unwrap_or(0)
}

/// Persist how many lessons a student has completed in a course.
pub fn set_completed_count(env: &Env, student: &Address, course_id: u32, count: u32) {
    env.storage().persistent().set(
        &StorageKey::StudentProgress(student.clone(), course_id),
        &count,
    );
}
