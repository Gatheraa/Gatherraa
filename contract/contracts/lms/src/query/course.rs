use soroban_sdk::{Env, Vec};

use crate::progress::{Course, Progress};

/// Read-only course and curriculum queries (#656).
pub struct CourseQueries;

impl CourseQueries {
    /// Look up a registered course, if one exists.
    ///
    /// Reads `StorageKey::Course(course_id)`, the same record written by
    /// course creation. A course that was never created reads as `None`.
    pub fn get_course(env: &Env, course_id: u32) -> Option<Course> {
        Progress::get_course(env, course_id)
    }

    /// List the module identifiers belonging to a course.
    ///
    /// Returns an empty list today: module storage does not exist on-chain
    /// yet, and course/module/lesson management is tracked in #640–#644.
    /// When that module lands it will read `StorageKey::Module(course_id)`
    /// and this function returns the modules that are actually stored.
    pub fn get_modules(env: &Env, course_id: u32) -> Vec<u32> {
        let _ = course_id;
        Vec::new(env)
    }

    /// List the lesson identifiers belonging to a module of a course.
    ///
    /// Returns an empty list today: lesson storage does not exist on-chain
    /// yet, and course/module/lesson management is tracked in #640–#644.
    /// When that module lands it will read
    /// `StorageKey::Lesson(course_id, module_id)` and this function returns
    /// the lessons that are actually stored.
    pub fn get_lessons(env: &Env, course_id: u32, module_id: u32) -> Vec<u32> {
        let _ = (course_id, module_id);
        Vec::new(env)
    }
}
