use soroban_sdk::Env;

use crate::course::types::CourseStatus;
use crate::progress::storage as progress_storage;

/// Returns the status of the course registered under the given identifier,
/// if any.
pub fn get_status(env: &Env, course_id: u32) -> Option<CourseStatus> {
    progress_storage::get_course(env, course_id).map(|course| course.status)
}

/// Persist a course record.
///
/// The lifecycle module never creates or deletes course records — it only
/// moves existing ones between states. Creation stays with
/// [`crate::progress`], which stamps every new course as a draft.
pub fn set_status(env: &Env, course_id: u32, status: CourseStatus) {
    let mut course = progress_storage::get_course(env, course_id).expect("course must exist");
    course.status = status;
    progress_storage::set_course(env, &course);
}

/// Persist a course's lesson count.
///
/// Used by `update_course`. Like `set_status`, this rewrites the existing
/// record rather than replacing it, so a state transition can never be
/// lost through a concurrent-looking overwrite.
pub fn set_total_lessons(env: &Env, course_id: u32, total_lessons: u32) {
    let mut course = progress_storage::get_course(env, course_id).expect("course must exist");
    course.total_lessons = total_lessons;
    progress_storage::set_course(env, &course);
}
