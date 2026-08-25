use soroban_sdk::{Address, Env};

use crate::course::Course;
use crate::progress::types::Progress;
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

/// Retrieve the progress record for a student on a specific lesson.
pub fn get_lesson_progress(
    env: &Env,
    student: &Address,
    course_id: u32,
    lesson_id: u32,
) -> Option<Progress> {
    env.storage()
        .persistent()
        .get(&StorageKey::LessonProgress(
            student.clone(),
            course_id,
            lesson_id,
        ))
}

/// Persist the progress record for a student on a specific lesson.
pub fn set_lesson_progress(env: &Env, progress: &Progress) {
    env.storage().persistent().set(
        &StorageKey::LessonProgress(
            progress.student.clone(),
            progress.course_id,
            progress.lesson_id,
        ),
        progress,
    );
}

/// Returns how many lessons a student has completed in a course.
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
